"""Metrics service — computes and stores user_metrics + chart_metrics in Supabase.

Called after every mutation tool so the agent and frontend always read consistent,
pre-computed numbers. All monetary values are stored in USD; the agent converts
at query time using the user's selected currency.
"""
import datetime
import logging

from app.models.investment import ASSET_TABLE_MAP, ASSET_TYPES
from app.utils.finance import calc_compound_interest

logger = logging.getLogger("finvoice.metrics")

# Auto-generated transfer categories to exclude from real spend/income charts
TRANSFER_CATEGORIES = {
    "investment_transfer",
    "investment_return",
    "savings_contribution",
    "savings_withdrawal",
}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────


def _normalize_inv_row(asset_type: str, row: dict) -> tuple[float, float]:
    """Return (invested_amount_usd, current_value_usd) for a raw inv_* row.

    All Group A tables share: quantity, buy_price_usd, current_price_usd.
    All Group B tables share: quantity, quantity_usd, apy, accumulated_interest_usd.
    Fund: quantity, buy_price_usd, current_value_usd.
    Forex: quantity, quantity_usd.
    """
    if asset_type in ("stock", "crypto", "commodity", "etf"):
        # Group A unified — all use 'quantity' column (etf was 'shares', now renamed)
        qty = float(row.get("quantity", 0))
        bp = float(row.get("buy_price_usd") or row.get("buy_price", 0))
        cp = float(row.get("current_price_usd") or row.get("current_price") or bp)
        return round(qty * bp, 4), round(qty * cp, 4)

    if asset_type == "fund":
        qty = float(row.get("quantity", 0))
        bp = float(row.get("buy_price_usd") or row.get("buy_price", 0))
        cv = float(row.get("current_value_usd") or row.get("current_value") or (qty * bp))
        return round(qty * bp, 4), round(cv, 4)

    if asset_type in ("fixedincome", "account", "crowdlending"):
        # Group B unified — all use 'quantity' / 'quantity_usd' (replaces principal/capital)
        qty_usd = float(row.get("quantity_usd") or row.get("quantity", 0))
        qty = float(row.get("quantity") or qty_usd)
        apy = float(row.get("apy", 0))
        frequency = row.get("frequency", "monthly")
        start_date = row.get("start_date", datetime.date.today().isoformat())
        accrued = calc_compound_interest(qty, apy, frequency, start_date)
        ratio = (qty_usd / qty) if qty > 0 else 1.0
        stored_usd = row.get("accumulated_interest_usd")
        if stored_usd is not None:
            interest_usd = float(stored_usd)
        else:
            interest_usd = accrued * ratio
        return round(qty_usd, 4), round(qty_usd + interest_usd, 4)

    if asset_type == "realestate":
        ev = float(row.get("estimated_value_usd") or row.get("estimated_value", 0))
        pm = float(row.get("pending_mortgage_usd") or row.get("pending_mortgage", 0))
        pp = float(row.get("purchase_price_usd") or row.get("purchase_price") or ev)
        return round(pp, 4), round(ev - pm, 4)

    if asset_type == "forex":
        qty = float(row.get("quantity_usd") or row.get("quantity", 0))
        return round(qty, 4), round(qty, 4)

    return 0.0, 0.0


def _month_key(y: int, m: int) -> str:
    """Return 'YYYY-MM' string."""
    return f"{y:04d}-{m:02d}"


def _parse_tx_month(date_str: str) -> tuple[int, int] | None:
    """Extract (year, month) from an ISO date/timestamp string. Returns None on error."""
    try:
        return int(date_str[:4]), int(date_str[5:7])
    except (TypeError, ValueError, IndexError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Main public function
# ─────────────────────────────────────────────────────────────────────────────

def refresh_user_metrics(supabase, user_id: str) -> dict:
    """Recompute all KPIs and chart data for a user and upsert into Supabase.

    Returns a summary dict (for logging / tool response).
    Called after every mutation tool.
    """
    try:
        # ── 1. Fetch raw data ─────────────────────────────────────────────────
        txs_resp = supabase.table("transactions").select("*").eq("user_id", user_id).execute()
        transactions = txs_resp.data or []

        pots_resp = supabase.table("savings_pots").select("*").eq("user_id", user_id).execute()
        pots = pots_resp.data or []

        budgets_resp = supabase.table("budgets").select("*").eq("user_id", user_id).execute()
        budgets = budgets_resp.data or []

        # Fetch all investment tables
        all_investments: list[tuple[str, dict]] = []
        for asset_type, table in ASSET_TABLE_MAP.items():
            try:
                inv_resp = supabase.table(table).select("*").eq("user_id", user_id).execute()
                for row in (inv_resp.data or []):
                    all_investments.append((asset_type, row))
            except Exception as e:
                logger.warning("Failed to fetch %s for metrics: %s", table, e)

        # ── 2. Current month bounds ───────────────────────────────────────────
        now = datetime.datetime.now(datetime.timezone.utc)
        current_year, current_month = now.year, now.month

        # ── 3. KPIs: Balance Tab ──────────────────────────────────────────────
        total_income_usd = 0.0
        total_expenses_usd = 0.0
        month_income_usd = 0.0
        month_expenses_usd = 0.0

        for tx in transactions:
            # Use amount_usd for consistent aggregation; fall back to amount for legacy rows
            amount = float(tx.get("amount_usd") or tx.get("amount", 0))
            tx_type = tx.get("type", "")
            ym = _parse_tx_month(tx.get("date", ""))

            if tx_type == "income":
                total_income_usd += amount
                if ym and ym == (current_year, current_month):
                    month_income_usd += amount
            elif tx_type == "expense":
                total_expenses_usd += amount
                if ym and ym == (current_year, current_month):
                    month_expenses_usd += amount

        balance_usd = round(total_income_usd - total_expenses_usd, 4)
        month_net_usd = round(month_income_usd - month_expenses_usd, 4)

        # ── 4. KPIs: Investments Tab ──────────────────────────────────────────
        total_invested_usd = 0.0
        total_current_value_usd = 0.0

        for asset_type, row in all_investments:
            inv_amt, cur_val = _normalize_inv_row(asset_type, row)
            total_invested_usd += inv_amt
            total_current_value_usd += cur_val

        total_invested_usd = round(total_invested_usd, 4)
        total_current_value_usd = round(total_current_value_usd, 4)
        total_pnl_usd = round(total_current_value_usd - total_invested_usd, 4)
        total_pnl_pct = round((total_pnl_usd / total_invested_usd * 100) if total_invested_usd > 0 else 0.0, 4)

        # ── 5. KPIs: Savings Tab ──────────────────────────────────────────────
        # Use current_balance_usd (dual storage) or convert current_balance back to USD
        savings_total_usd = 0.0
        for p in pots:
            usd_bal = p.get("current_balance_usd")
            if usd_bal is not None:
                savings_total_usd += float(usd_bal)
            else:
                raw_bal = float(p.get("current_balance", 0))
                rate = float(p.get("rate_at_entry") or 1.0)
                # If 1$ = 0.8684€, then USD = EUR / 0.8684
                savings_total_usd += raw_bal / rate if rate > 0 else raw_bal
                
        savings_total_usd = round(savings_total_usd, 4)
        savings_active_pots = len(pots)

        # This month savings contributions (using amount_usd)
        savings_this_month_usd = 0.0
        for tx in transactions:
            if tx.get("category") == "savings_contribution":
                ym = _parse_tx_month(tx.get("date", ""))
                if ym and ym == (current_year, current_month):
                    savings_this_month_usd += float(tx.get("amount_usd") or tx.get("amount", 0))
        savings_this_month_usd = round(savings_this_month_usd, 4)

        # Savings rate = this_month_contributions / this_month_income * 100
        savings_rate_pct = round(
            (savings_this_month_usd / month_income_usd * 100) if month_income_usd > 0 else 0.0, 4
        )

        # Best month: compute monthly contributions for all 12 months, find max
        monthly_contributions: dict[str, float] = {}
        for tx in transactions:
            if tx.get("category") == "savings_contribution":
                ym = _parse_tx_month(tx.get("date", ""))
                if ym:
                    key = _month_key(*ym)
                    monthly_contributions[key] = monthly_contributions.get(key, 0.0) + float(tx.get("amount_usd") or tx.get("amount", 0))

        savings_best_month_usd = 0.0
        savings_best_month_label = ""
        if monthly_contributions:
            best_key = max(monthly_contributions, key=monthly_contributions.__getitem__)
            savings_best_month_usd = round(monthly_contributions[best_key], 4)
            y, m = int(best_key[:4]), int(best_key[5:7])
            import calendar
            savings_best_month_label = f"{calendar.month_abbr[m]} {y}"

        # ── 6. Summary Net Worth ──────────────────────────────────────────────
        net_worth_usd = round(balance_usd + total_current_value_usd + savings_total_usd, 4)

        # ── 7. Upsert user_metrics ────────────────────────────────────────────
        metrics_payload = {
            "user_id": user_id,
            "net_worth_usd": net_worth_usd,
            "balance_usd": balance_usd,
            "investment_value_usd": total_current_value_usd,
            "savings_total_usd": savings_total_usd,
            "total_income_usd": round(total_income_usd, 4),
            "total_expenses_usd": round(total_expenses_usd, 4),
            "month_income_usd": round(month_income_usd, 4),
            "month_expenses_usd": round(month_expenses_usd, 4),
            "month_net_usd": month_net_usd,
            "total_invested_usd": total_invested_usd,
            "total_current_value_usd": total_current_value_usd,
            "total_pnl_usd": total_pnl_usd,
            "total_pnl_pct": total_pnl_pct,
            "savings_active_pots": savings_active_pots,
            "savings_rate_pct": savings_rate_pct,
            "savings_this_month_usd": savings_this_month_usd,
            "savings_best_month_usd": savings_best_month_usd,
            "savings_best_month_label": savings_best_month_label,
            "refreshed_at": now.isoformat(),
        }

        supabase.table("user_metrics").upsert(metrics_payload, on_conflict="user_id").execute()
        logger.info("user_metrics refreshed for user %s", user_id)

        # ── 8. Compute chart data ─────────────────────────────────────────────
        _refresh_chart_metrics(
            supabase, user_id, transactions, all_investments,
            pots, budgets, monthly_contributions,
            current_year, current_month, now
        )

        # ── 9. Health monitoring metrics ───────────────────────────────────────
        chart_metrics_count = 0
        try:
            chart_resp = supabase.table("chart_metrics").select("id").eq("user_id", user_id).execute()
            chart_metrics_count = len(chart_resp.data or [])
        except Exception as e:
            logger.warning("Failed to count chart_metrics for health check: %s", e)

        logger.info(
            "Metrics health check: user %s has %d chart_metrics rows (expected ~93)",
            user_id, chart_metrics_count
        )

        return {
            "net_worth_usd": net_worth_usd,
            "balance_usd": balance_usd,
            "investment_value_usd": total_current_value_usd,
            "savings_total_usd": savings_total_usd,
            "chart_metrics_count": chart_metrics_count,
        }

    except Exception as e:
        logger.error("refresh_user_metrics failed for %s: %s", user_id, e, exc_info=True)
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Chart data refresh
# ─────────────────────────────────────────────────────────────────────────────

def _refresh_chart_metrics(
    supabase, user_id: str,
    transactions: list[dict],
    all_investments: list[tuple[str, dict]],
    pots: list[dict],
    budgets: list[dict],
    monthly_contributions: dict[str, float],
    current_year: int, current_month: int,
    now: datetime.datetime,
) -> None:
    """Compute and upsert all chart_metrics rows for the user."""
    try:
        _refresh_chart_metrics_inner(
            supabase, user_id, transactions, all_investments,
            pots, budgets, monthly_contributions,
            current_year, current_month, now
        )
    except Exception as e:
        logger.error("_refresh_chart_metrics failed for user %s: %s", user_id, e, exc_info=True)


def _refresh_chart_metrics_inner(
    supabase, user_id: str,
    transactions: list[dict],
    all_investments: list[tuple[str, dict]],
    pots: list[dict],
    budgets: list[dict],
    monthly_contributions: dict[str, float],
    current_year: int, current_month: int,
    now: datetime.datetime,
) -> None:
    """Inner implementation — called by _refresh_chart_metrics with error boundary."""
    rows_to_upsert: list[dict] = []

    # ── A. Wealth Evolution (12 months) ──────────────────────────────────────
    # For each of the last 12 months: balance, investment_value, savings, net_worth
    # Uses monthly_snapshots for closed months where available.

    # Fetch existing snapshots
    snap_resp = supabase.table("monthly_snapshots").select("*").eq("user_id", user_id).execute()
    snapshots: dict[str, dict] = {}
    for s in (snap_resp.data or []):
        key = _month_key(s["year"], s["month"])
        snapshots[key] = s

    # Build 12-month series
    months_12: list[tuple[int, int]] = []
    for i in range(11, -1, -1):
        m = current_month - i
        y = current_year
        while m <= 0:
            m += 12
            y -= 1
        months_12.append((y, m))

    import calendar as _cal
    for y, m in months_12:
        key = _month_key(y, m)
        snap = snapshots.get(key)

        if snap and (y, m) != (current_year, current_month):
            # Use stored snapshot for closed months
            balance_m = float(snap.get("balance", 0))
            inv_m = float(snap.get("investment_value", 0))
            sav_m = float(snap.get("savings_value", 0))
            nw_m = float(snap.get("net_worth", balance_m + inv_m + sav_m))
        else:
            # Real-time: sum transactions up to end of month (use amount_usd for consistency)
            inc_m = sum(
                float(tx.get("amount_usd") or tx.get("amount", 0))
                for tx in transactions
                if tx.get("type") == "income"
                and _tx_in_or_before(tx.get("date", ""), y, m)
            )
            exp_m = sum(
                float(tx.get("amount_usd") or tx.get("amount", 0))
                for tx in transactions
                if tx.get("type") == "expense"
                and _tx_in_or_before(tx.get("date", ""), y, m)
            )
            balance_m = round(inc_m - exp_m, 4)
            # For the current month use live investment/savings values; closed months show 0
            # (closed months use the monthly_snapshots branch above)
            if (y, m) == (current_year, current_month):
                inv_m = sum(_normalize_inv_row(at, r)[1] for at, r in all_investments)
                sav_m = sum(float(p.get("current_balance_usd") or p.get("current_balance", 0)) for p in pots)
            else:
                inv_m = 0.0
                sav_m = 0.0
            nw_m = round(balance_m + inv_m + sav_m, 4)

        # Monthly income/expense for this month (for sparklines)
        inc_month = sum(
            float(tx.get("amount_usd") or tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "income"
            and _parse_tx_month(tx.get("date", "")) == (y, m)
        )
        exp_month = sum(
            float(tx.get("amount_usd") or tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "expense"
            and _parse_tx_month(tx.get("date", "")) == (y, m)
        )

        contributions_m = monthly_contributions.get(key, 0.0)
        withdrawals_m = sum(
            float(tx.get("amount_usd") or tx.get("amount", 0))
            for tx in transactions
            if tx.get("category") == "savings_withdrawal"
            and _parse_tx_month(tx.get("date", "")) == (y, m)
        )

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "wealth_evolution",
            "period_key": key,
            "data": {
                "label": f"{_cal.month_abbr[m]} {y}",
                "balance_usd": round(balance_m, 2),
                "investment_usd": round(inv_m, 2),
                "savings_usd": round(sav_m, 2),
                "net_worth_usd": round(nw_m, 2),
                "income_usd": round(inc_month, 2),
                "expenses_usd": round(exp_month, 2),
                "contributions_usd": round(contributions_m, 2),
                "withdrawals_usd": round(withdrawals_m, 2),
                "net_savings_usd": round(contributions_m - withdrawals_m, 2),
            },
            "refreshed_at": now.isoformat(),
        })

    # ── B. Savings: monthly bar + cumulative line (12 months) ─────────────────
    cumulative = 0.0
    for y, m in months_12:
        key = _month_key(y, m)
        contributions_m = monthly_contributions.get(key, 0.0)
        withdrawals_m = sum(
            float(tx.get("amount_usd") or tx.get("amount", 0))
            for tx in transactions
            if tx.get("category") == "savings_withdrawal"
            and _parse_tx_month(tx.get("date", "")) == (y, m)
        )
        net_m = contributions_m - withdrawals_m
        cumulative += net_m

        income_m = sum(
            float(tx.get("amount_usd") or tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "income"
            and _parse_tx_month(tx.get("date", "")) == (y, m)
        )
        savings_rate_m = round((contributions_m / income_m * 100) if income_m > 0 else 0.0, 2)

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "savings_monthly",
            "period_key": key,
            "data": {
                "label": f"{_cal.month_abbr[m]} {y}",
                "contributions_usd": round(contributions_m, 2),
                "withdrawals_usd": round(withdrawals_m, 2),
                "net_usd": round(net_m, 2),
                "income_usd": round(income_m, 2),
                "savings_rate_pct": savings_rate_m,
            },
            "refreshed_at": now.isoformat(),
        })

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "savings_cumulative",
            "period_key": key,
            "data": {
                "label": f"{_cal.month_abbr[m]} {y}",
                "cumulative_usd": round(cumulative, 2),
                "net_usd": round(net_m, 2),
            },
            "refreshed_at": now.isoformat(),
        })

    # ── C. Balance by Category (expenses) ─────────────────────────────────────
    exp_by_cat: dict[str, float] = {}
    inc_by_cat: dict[str, float] = {}
    for tx in transactions:
        cat = tx.get("category", "other")
        if cat in TRANSFER_CATEGORIES:
            continue
        amount = float(tx.get("amount_usd") or tx.get("amount", 0))
        if tx.get("type") == "expense":
            exp_by_cat[cat] = exp_by_cat.get(cat, 0.0) + amount
        elif tx.get("type") == "income":
            inc_by_cat[cat] = inc_by_cat.get(cat, 0.0) + amount

    for cat, val in sorted(exp_by_cat.items(), key=lambda x: -x[1]):
        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "balance_by_category_expense",
            "period_key": cat,
            "data": {"name": cat, "value_usd": round(val, 2)},
            "refreshed_at": now.isoformat(),
        })

    for cat, val in sorted(inc_by_cat.items(), key=lambda x: -x[1]):
        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "balance_by_category_income",
            "period_key": cat,
            "data": {"name": cat, "value_usd": round(val, 2)},
            "refreshed_at": now.isoformat(),
        })

    # ── D. Investment by Asset Type ───────────────────────────────────────────
    inv_by_type: dict[str, dict] = {}
    for asset_type in ASSET_TYPES:
        inv_by_type[asset_type] = {"invested_usd": 0.0, "current_value_usd": 0.0, "pnl_usd": 0.0, "count": 0}

    for asset_type, row in all_investments:
        inv_amt, cur_val = _normalize_inv_row(asset_type, row)
        inv_by_type[asset_type]["invested_usd"] += inv_amt
        inv_by_type[asset_type]["current_value_usd"] += cur_val
        inv_by_type[asset_type]["pnl_usd"] += cur_val - inv_amt
        inv_by_type[asset_type]["count"] += 1

    for asset_type, vals in inv_by_type.items():
        if vals["count"] == 0:
            continue
        invested = round(vals["invested_usd"], 2)
        current = round(vals["current_value_usd"], 2)
        pnl = round(vals["pnl_usd"], 2)
        pnl_pct = round((pnl / invested * 100) if invested > 0 else 0.0, 2)

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "investment_by_type",
            "period_key": asset_type,
            "data": {
                "name": asset_type,
                "count": vals["count"],
                "invested_usd": invested,
                "current_value_usd": current,
                "pnl_usd": pnl,
                "pnl_pct": pnl_pct,
            },
            "refreshed_at": now.isoformat(),
        })

    # ── E. Budget progress snapshot ───────────────────────────────────────────
    for budget in budgets:
        bud_id = budget.get("id", "")
        bud_name = budget.get("name", "")
        categories = budget.get("categories") or []
        recurrence = budget.get("recurrence", "monthly")
        date_from_str = budget.get("date_from")

        from_dt, to_dt = _get_budget_cycle(recurrence, now)

        spent = 0.0
        for tx in transactions:
            if tx.get("type") != "expense":
                continue
            tx_date_str = tx.get("date", "")
            try:
                tx_date = datetime.datetime.fromisoformat(tx_date_str.replace("Z", "+00:00"))
                if tx_date.tzinfo is None:
                    tx_date = tx_date.replace(tzinfo=datetime.timezone.utc)
            except (ValueError, TypeError):
                continue
            if tx_date < from_dt or tx_date > to_dt:
                continue
            if date_from_str:
                try:
                    df = datetime.datetime.fromisoformat(date_from_str.replace("Z", "+00:00"))
                    if df.tzinfo is None:
                        df = df.replace(tzinfo=datetime.timezone.utc)
                    if tx_date < df:
                        continue
                except (ValueError, TypeError):
                    pass
            cat = tx.get("category", "")
            if categories and cat not in [c.lower() for c in categories]:
                continue
            spent += float(tx.get("amount_usd") or tx.get("amount", 0))

        # bud_amount is in the budget's own currency; use amount_usd for spent (both in USD)
        bud_amount_usd = float(budget.get("amount_usd") or budget.get("amount", 0))
        remaining = bud_amount_usd - spent
        pct = round((spent / bud_amount_usd * 100) if bud_amount_usd > 0 else 0.0, 2)

        short_id = budget.get("short_id")
        key = str(short_id) if short_id is not None else bud_id

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "budget_progress",
            "period_key": key,
            "data": {
                "budget_id": bud_id,
                "short_id": short_id,
                "name": bud_name,
                "amount_usd": round(bud_amount_usd, 2),
                "spent_usd": round(spent, 2),
                "remaining_usd": round(remaining, 2),
                "progress_pct": pct,
                "recurrence": recurrence,
                "categories": categories,
            },
            "refreshed_at": now.isoformat(),
        })

    # ── F. Savings pot progress ────────────────────────────────────────────────
    for pot in pots:
        pot_id = pot.get("id", "")
        pot_name = pot.get("name", "")
        # Use *_usd fields (dual storage), fallback to original for legacy rows
        balance = float(pot.get("current_balance_usd") or pot.get("current_balance", 0))
        target_raw = pot.get("target_amount_usd") or pot.get("target_amount")
        target_f = float(target_raw) if target_raw else None
        pct = round((balance / target_f * 100) if target_f and target_f > 0 else 0.0, 2)

        short_id = pot.get("short_id")
        key = str(short_id) if short_id is not None else pot_id

        rows_to_upsert.append({
            "user_id": user_id,
            "chart_type": "savings_pot_progress",
            "period_key": key,
            "data": {
                "pot_id": pot_id,
                "short_id": short_id,
                "name": pot_name,
                "balance_usd": round(balance, 2),
                "target_usd": round(target_f, 2) if target_f else None,
                "progress_pct": pct,
            },
            "refreshed_at": now.isoformat(),
        })

    # ── Batch upsert all rows ─────────────────────────────────────────────────
    if rows_to_upsert:
        # Supabase upsert in chunks of 100 to avoid payload limits
        chunk_size = 100
        for i in range(0, len(rows_to_upsert), chunk_size):
            chunk = rows_to_upsert[i : i + chunk_size]
            try:
                supabase.table("chart_metrics").upsert(
                    chunk, on_conflict="user_id,chart_type,period_key"
                ).execute()
            except Exception as e:
                logger.error("chart_metrics upsert chunk %d failed: %s", i // chunk_size, e)

    logger.info("chart_metrics refreshed: %d rows for user %s", len(rows_to_upsert), user_id)


# ─────────────────────────────────────────────────────────────────────────────
# Query functions — called by agent tools
# ─────────────────────────────────────────────────────────────────────────────

def get_financial_summary(supabase, user_id: str, user_currency: str = "USD") -> dict:
    """Read user_metrics and convert all USD values to user_currency for the agent."""
    resp = supabase.table("user_metrics").select("*").eq("user_id", user_id).maybe_single().execute()
    if not resp.data:
        return {"error": "No metrics found. Make sure you have added some transactions or investments first."}

    m = resp.data
    rate = _get_rate(supabase, user_currency)
    sym = {"USD": "$", "EUR": "€", "GBP": "£"}.get(user_currency, "$")

    def c(v: float) -> float:
        return round(float(v or 0) * rate, 2)

    return {
        "currency": user_currency,
        "symbol": sym,
        # Summary
        "net_worth": c(m["net_worth_usd"]),
        "balance": c(m["balance_usd"]),
        "investment_value": c(m["investment_value_usd"]),
        "savings_total": c(m["savings_total_usd"]),
        # Balance
        "total_income": c(m["total_income_usd"]),
        "total_expenses": c(m["total_expenses_usd"]),
        "month_income": c(m["month_income_usd"]),
        "month_expenses": c(m["month_expenses_usd"]),
        "month_net": c(m["month_net_usd"]),
        # Investments
        "total_invested": c(m["total_invested_usd"]),
        "total_current_value": c(m["total_current_value_usd"]),
        "total_pnl": c(m["total_pnl_usd"]),
        "total_pnl_pct": float(m["total_pnl_pct"] or 0),
        # Savings
        "savings_active_pots": int(m["savings_active_pots"] or 0),
        "savings_rate_pct": float(m["savings_rate_pct"] or 0),
        "savings_this_month": c(m["savings_this_month_usd"]),
        "savings_best_month": c(m["savings_best_month_usd"]),
        "savings_best_month_label": m.get("savings_best_month_label", ""),
        "refreshed_at": m.get("refreshed_at"),
    }


def get_chart_data(supabase, user_id: str, chart_type: str, user_currency: str = "USD") -> dict:
    """Return all rows for a given chart_type, with monetary values converted to user_currency.

    chart_type options:
      wealth_evolution, savings_monthly, savings_cumulative,
      balance_by_category_expense, balance_by_category_income,
      investment_by_type, budget_progress, savings_pot_progress
    """
    resp = (
        supabase.table("chart_metrics")
        .select("period_key, data")
        .eq("user_id", user_id)
        .eq("chart_type", chart_type)
        .order("period_key")
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return {"chart_type": chart_type, "rows": [], "note": "No data available yet."}

    rate = _get_rate(supabase, user_currency)

    def _convert_row(data: dict) -> dict:
        """Deep-convert all keys ending in _usd to user_currency."""
        out = {}
        for k, v in data.items():
            if k.endswith("_usd") and isinstance(v, (int, float)) and v is not None:
                out[k.replace("_usd", f"_{user_currency.lower()}")] = round(float(v) * rate, 2)
            else:
                out[k] = v
        return out

    converted = [
        {"period_key": r["period_key"], **_convert_row(r["data"])}
        for r in rows
    ]

    return {"chart_type": chart_type, "currency": user_currency, "rows": converted}


# ─────────────────────────────────────────────────────────────────────────────
# Internal utilities
# ─────────────────────────────────────────────────────────────────────────────

def _get_rate(supabase, currency: str) -> float:
    """Get USD→currency conversion rate (multiplier).

    exchange_rates.rate_vs_usd stores how many units of currency equal 1 USD
    (e.g. EUR rate_vs_usd=0.8684 means 1 USD = 0.8684 EUR).
    To convert USD→currency we multiply by rate_vs_usd.

    Matches the convention in transaction_service.resolve_currency():
        amount_usd = amount_original / rate_vs_usd
    So the inverse: amount_currency = amount_usd * rate_vs_usd ✓
    """
    if currency == "USD":
        return 1.0
    # Derived from transaction_service._FALLBACK_RATES_VS_USD (EUR=1.08, GBP=1.27).
    # rate_vs_usd (1 EUR = 1.08 USD) → USD→display = 1/1.08 = 0.9259; 1/1.27 = 0.7874
    FALLBACK = {"EUR": round(1 / 1.08, 4), "GBP": round(1 / 1.27, 4)}  # 0.9259, 0.7874
    try:
        resp = supabase.table("exchange_rates").select("rate_vs_usd").eq("currency", currency).execute()
        if resp.data:
            rate_vs_usd = float(resp.data[0]["rate_vs_usd"])
            # rate_vs_usd = how many currency units per 1 USD → multiply to convert USD→currency
            return rate_vs_usd if rate_vs_usd > 0 else 1.0
    except Exception:
        pass
    # Fallback: hardcoded approximate USD→currency factor
    return FALLBACK.get(currency, 1.0)


def _tx_in_or_before(date_str: str, year: int, month: int) -> bool:
    """Return True if transaction date is in or before the given (year, month)."""
    ym = _parse_tx_month(date_str)
    if not ym:
        return False
    ty, tm = ym
    return (ty, tm) <= (year, month)


def _get_budget_cycle(recurrence: str, now: datetime.datetime) -> tuple[datetime.datetime, datetime.datetime]:
    """Return (from_dt, to_dt) for the current cycle of a budget."""
    tz = datetime.timezone.utc
    y, m = now.year, now.month

    if recurrence == "monthly":
        from_dt = datetime.datetime(y, m, 1, tzinfo=tz)
        import calendar as _cal2
        last_day = _cal2.monthrange(y, m)[1]
        to_dt = datetime.datetime(y, m, last_day, 23, 59, 59, tzinfo=tz)
    elif recurrence == "weekly":
        weekday = now.weekday()  # 0=Monday
        from_dt = (now - datetime.timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz)
        to_dt = (from_dt + datetime.timedelta(days=6)).replace(hour=23, minute=59, second=59)
    elif recurrence == "daily":
        from_dt = now.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz)
        to_dt = now.replace(hour=23, minute=59, second=59, tzinfo=tz)
    elif recurrence == "yearly":
        from_dt = datetime.datetime(y, 1, 1, tzinfo=tz)
        to_dt = datetime.datetime(y, 12, 31, 23, 59, 59, tzinfo=tz)
    else:
        # Default: monthly
        from_dt = datetime.datetime(y, m, 1, tzinfo=tz)
        import calendar as _cal3
        last_day = _cal3.monthrange(y, m)[1]
        to_dt = datetime.datetime(y, m, last_day, 23, 59, 59, tzinfo=tz)

    return from_dt, to_dt
