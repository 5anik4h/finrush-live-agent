"""Investment domain service — all Supabase queries and business logic for investments."""
import asyncio
import datetime
import logging

from app.models.investment import (
    AddInvestmentArgs,
    GetInvestmentsArgs,
    UpdateInvestmentArgs,
    DeleteInvestmentArgs,
    SellInvestmentArgs,
    ASSET_TABLE_MAP,
    ASSET_TYPES,
    PRICE_FETCH_TYPES,
    GROUP_B_TYPES,
)
from app.utils.finance import calc_compound_interest

logger = logging.getLogger("finvoice.tools")


def _get_inv_table(asset_type: str) -> str:
    return ASSET_TABLE_MAP.get(asset_type, "inv_stocks")


def normalize_investment(asset_type: str, row: dict) -> dict:
    """Convert a row from any inv_* table to a unified response format.

    All Group A tables share identical columns (quantity, buy_price, buy_price_usd,
    current_price, current_price_usd). All Group B tables share (quantity, quantity_usd,
    apy, frequency, reinvest, accumulated_interest, accumulated_interest_usd,
    start_date, end_date).
    """
    base = {
        "id": row.get("id"),
        "short_id": row.get("short_id"),
        "asset_type": asset_type,
        "name": row.get("name") or row.get("ticker", ""),
        "currency": row.get("currency", "USD"),
        "rate_at_entry": row.get("rate_at_entry"),
    }

    if asset_type in PRICE_FETCH_TYPES:
        # Group A: stock, crypto, etf, commodity — all use quantity column
        qty = float(row.get("quantity", 0))
        bp = float(row.get("buy_price", 0))
        cp = float(row.get("current_price") or bp)
        bp_usd = float(row.get("buy_price_usd") or bp)
        cp_usd = float(row.get("current_price_usd") or cp)
        base["ticker"] = row.get("ticker", "")
        base["quantity"] = qty
        base["buy_price"] = bp
        base["current_price"] = cp
        base["buy_price_usd"] = bp_usd
        base["current_price_usd"] = cp_usd
        base["invested_amount"] = round(qty * bp, 2)
        base["current_value"] = round(qty * cp, 2)
        base["invested_amount_usd"] = round(qty * bp_usd, 2)
        base["current_value_usd"] = round(qty * cp_usd, 2)

    elif asset_type == "fund":
        qty = float(row.get("quantity", 0))
        bp = float(row.get("buy_price", 0))
        bp_usd = float(row.get("buy_price_usd") or bp)
        cv = float(row.get("current_value") or (qty * bp))
        cv_usd = float(row.get("current_value_usd") or cv)
        base["quantity"] = qty
        base["buy_price"] = bp
        base["buy_price_usd"] = bp_usd
        base["ter"] = row.get("ter")
        base["invested_amount"] = round(qty * bp, 2)
        base["current_value"] = round(cv, 2)
        base["invested_amount_usd"] = round(qty * bp_usd, 2)
        base["current_value_usd"] = round(cv_usd, 2)

    elif asset_type in GROUP_B_TYPES:
        # Group B unified: fixedincome, account, crowdlending — all use quantity column
        qty = float(row.get("quantity", 0))
        qty_usd = float(row.get("quantity_usd") or qty)
        apy = float(row.get("apy", 0))
        frequency = row.get("frequency", "monthly")
        start_date = row.get("start_date", datetime.date.today().isoformat())
        reinvest = bool(row.get("reinvest", False))

        accrued = calc_compound_interest(qty, apy, frequency, start_date)
        rate_ratio = (qty_usd / qty) if qty > 0 else 1.0
        accrued_usd = round(accrued * rate_ratio, 6)

        # Prefer stored accumulated_interest_usd over calculated (for fixedincome and crowdlending)
        stored_interest_usd = row.get("accumulated_interest_usd")
        if stored_interest_usd is not None:
            accrued_usd = float(stored_interest_usd)

        base["quantity"] = qty
        base["apy"] = apy
        base["frequency"] = frequency
        base["reinvest"] = reinvest
        base["start_date"] = start_date
        base["end_date"] = row.get("end_date")
        base["accumulated_interest"] = round(accrued, 2)
        base["invested_amount"] = round(qty, 2)
        base["current_value"] = round(qty + accrued, 2)
        base["invested_amount_usd"] = round(qty_usd, 2)
        base["current_value_usd"] = round(qty_usd + accrued_usd, 2)

    elif asset_type == "realestate":
        ev = float(row.get("estimated_value", 0))
        pm = float(row.get("pending_mortgage", 0))
        pp = float(row.get("purchase_price") or ev)
        ev_usd = float(row.get("estimated_value_usd") or ev)
        pm_usd = float(row.get("pending_mortgage_usd") or pm)
        pp_usd = float(row.get("purchase_price_usd") or pp)
        mr = row.get("monthly_rent")
        mr_usd = row.get("monthly_rent_usd")
        base["invested_amount"] = round(pp, 2)
        base["current_value"] = round(ev - pm, 2)
        base["invested_amount_usd"] = round(pp_usd, 2)
        base["current_value_usd"] = round(ev_usd - pm_usd, 2)
        base["monthly_rent"] = mr
        base["monthly_rent_usd"] = mr_usd
        base["estimated_value"] = ev
        base["estimated_value_usd"] = ev_usd
        base["pending_mortgage"] = pm
        base["pending_mortgage_usd"] = pm_usd
        base["purchase_price"] = pp
        base["purchase_price_usd"] = pp_usd

    elif asset_type == "forex":
        qty = float(row.get("quantity", 0))
        qty_usd = float(row.get("quantity_usd") or qty)
        base["quantity"] = qty
        base["invested_amount"] = round(qty, 2)
        base["current_value"] = round(qty, 2)
        base["invested_amount_usd"] = round(qty_usd, 2)
        base["current_value_usd"] = round(qty_usd, 2)

    else:
        base["invested_amount"] = 0
        base["current_value"] = 0
        base["invested_amount_usd"] = 0
        base["current_value_usd"] = 0

    invested = base.get("invested_amount", 0)
    current = base.get("current_value", 0)
    base["pnl_absolute"] = round(current - invested, 2)
    base["pnl_percent"] = round(((current - invested) / invested) * 100, 2) if invested > 0 else 0
    invested_usd = base.get("invested_amount_usd", invested)
    current_usd = base.get("current_value_usd", current)
    base["pnl_absolute_usd"] = round(current_usd - invested_usd, 2)
    base["pnl_percent_usd"] = round(((current_usd - invested_usd) / invested_usd) * 100, 2) if invested_usd > 0 else 0

    return base


async def _resolve_qty_price(args, user_id: str) -> tuple | dict:
    """Resolve quantity and unit price for Group A types.

    Returns (qty, price_per_unit, invested) or error dict.
    If price fetch fails, buy_price defaults to 0 (not an error).
    """
    from app.services.price_service import fetch_current_price

    qty = args.quantity
    price_per_unit = args.buy_price
    total = args.total_amount

    realtime_price = None
    if args.ticker and args.asset_type in PRICE_FETCH_TYPES:
        try:
            realtime_price = await asyncio.wait_for(
                fetch_current_price(args.ticker, args.asset_type),
                timeout=8.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Price fetch timed out for %s", args.ticker, extra={"user_id": user_id})
        except Exception as e:
            logger.warning("Price fetch failed for %s: %s", args.ticker, e, extra={"user_id": user_id})

    if qty is not None and price_per_unit is not None:
        pass
    elif total is not None:
        if qty is not None:
            price_per_unit = total / qty
        elif price_per_unit is not None:
            qty = total / price_per_unit
        else:
            price_per_unit = realtime_price or 0.0
            qty = (total / price_per_unit) if price_per_unit > 0 else total
    elif qty is not None:
        price_per_unit = realtime_price or 0.0
    elif price_per_unit is not None:
        return {"error": "Please provide quantity or total_amount together with buy_price."}
    else:
        return {"error": "Please provide at least quantity or total_amount."}

    if qty is None:
        return {"error": "Could not determine quantity."}

    price_per_unit = price_per_unit or 0.0
    invested = qty * price_per_unit
    return qty, price_per_unit, invested, realtime_price


async def add_investment(supabase, user_id: str, args: AddInvestmentArgs, language: str, user_currency: str) -> dict:
    from app.services.transaction_service import _resolve_timestamp, resolve_currency as _rc

    table = _get_inv_table(args.asset_type)
    date_str = _resolve_timestamp(args.date)
    extra = args.extra or {}
    currency = (args.currency or user_currency or "USD").upper()

    if args.asset_type in PRICE_FETCH_TYPES:
        result = await _resolve_qty_price(args, user_id)
        if isinstance(result, dict):
            return result
        qty, price_per_unit, invested_raw, realtime_price = result

        # If price came from live fetch (realtime_price), it may be in exchange native currency.
        # Use args.currency if user explicitly stated one, otherwise use user_currency.
        # The price_per_unit from live fetch needs to be interpreted in user's currency context.
        cur = currency
        bp_orig, bp_usd, rate = _rc(price_per_unit, cur, user_currency, supabase)
        data: dict = {
            "user_id": user_id,
            "ticker": (args.ticker or args.name[:10]).upper(),
            "name": args.name or args.ticker,
            "quantity": qty,
            "buy_price": bp_orig,
            "buy_price_usd": bp_usd,
            "current_price": bp_orig,
            "current_price_usd": bp_usd,
            "currency": cur,
            "rate_at_entry": rate,
            "date": date_str,
        }
        invested = qty * bp_usd

    elif args.asset_type == "fund":
        # Fund: quantity × buy_price = invested; current_value can differ
        qty = args.quantity or 1.0
        bp_raw = args.buy_price or 0.0
        total = args.total_amount
        if total and total > 0 and bp_raw <= 0:
            # total_amount provided without buy_price → derive buy_price from qty
            bp_raw = total / qty if qty > 0 else total
        elif total and total > 0 and bp_raw > 0 and not args.quantity:
            qty = total / bp_raw
        if bp_raw <= 0 and not total:
            return {"error": "Please provide buy_price or total_amount for the fund."}
        cv_raw = extra.get("current_value", qty * bp_raw)
        bp_orig, bp_usd, rate = _rc(bp_raw, currency, user_currency, supabase)
        cv_orig, cv_usd, _ = _rc(cv_raw, currency, user_currency, supabase)
        invested = qty * bp_usd
        data = {
            "user_id": user_id,
            "name": args.name,
            "quantity": qty,
            "buy_price": bp_orig,
            "buy_price_usd": bp_usd,
            "current_value": cv_orig,
            "current_value_usd": cv_usd,
            "ter": extra.get("ter", extra.get("management_fee")),
            "currency": currency,
            "rate_at_entry": rate,
            "date": date_str,
        }

    elif args.asset_type in GROUP_B_TYPES:
        # Group B unified: principal/capital → quantity
        qty = args.total_amount or (args.quantity or 0) * (args.buy_price or 1)
        if qty <= 0:
            return {"error": "Please provide the principal amount (total_amount or quantity) for this investment."}
        apy = extra.get("apy", extra.get("interest_rate", 0))
        if apy <= 0:
            return {"error": "Please provide a valid APY (annual percentage yield > 0)."}
        q_orig, q_usd, rate = _rc(qty, currency, user_currency, supabase)
        invested = q_usd
        data = {
            "user_id": user_id,
            "name": args.name,
            "currency": currency,
            "quantity": q_orig,
            "quantity_usd": q_usd,
            "rate_at_entry": rate,
            "apy": apy,
            "frequency": extra.get("frequency", "monthly"),
            "accumulated_interest": 0,
            "accumulated_interest_usd": 0.0,
            "reinvest": extra.get("reinvest", False),
            "start_date": date_str,
            "end_date": extra.get("end_date"),
        }

    elif args.asset_type == "realestate":
        est_value = extra.get("estimated_value", args.total_amount or 0)
        if est_value <= 0:
            return {"error": "Please provide estimated_value for real estate."}
        pm_raw = extra.get("pending_mortgage", 0)
        pp_raw = extra.get("purchase_price", est_value)
        mr_raw = extra.get("monthly_rent", 0)
        ev_orig, ev_usd, rate = _rc(est_value, currency, user_currency, supabase)
        pm_orig, pm_usd, _ = _rc(pm_raw, currency, user_currency, supabase)
        pp_orig, pp_usd, _ = _rc(pp_raw, currency, user_currency, supabase)
        mr_orig, mr_usd, _ = _rc(mr_raw, currency, user_currency, supabase)
        # Real estate does NOT create an investment_transfer transaction
        invested = 0
        data = {
            "user_id": user_id,
            "name": args.name,
            "estimated_value": ev_orig,
            "estimated_value_usd": ev_usd,
            "pending_mortgage": pm_orig,
            "pending_mortgage_usd": pm_usd,
            "monthly_rent": mr_orig if mr_raw else None,
            "monthly_rent_usd": mr_usd if mr_raw else None,
            "purchase_price": pp_orig,
            "purchase_price_usd": pp_usd,
            "currency": currency,
            "rate_at_entry": rate,
            "date": date_str,
            "rent_start_date": date_str if mr_raw else None,
        }

    elif args.asset_type == "forex":
        qty = args.quantity or args.total_amount or 0
        if qty <= 0:
            return {"error": "Please provide the amount (quantity) for the forex deposit."}
        # currency is the currency of the deposit (what user is depositing)
        q_orig, q_usd, rate = _rc(qty, currency, user_currency, supabase)
        # Auto-generate name if not meaningful
        name = args.name if args.name else f"Depósito en {currency}"
        invested = q_usd
        data = {
            "user_id": user_id,
            "name": name,
            "quantity": q_orig,
            "quantity_usd": q_usd,
            "currency": currency,
            "rate_at_entry": rate,
            "date": date_str,
        }

    else:
        return {"error": f"Unknown asset type: {args.asset_type}"}

    try:
        response = supabase.table(table).insert(data).execute()
        if not (hasattr(response, "data") and len(response.data) > 0):
            return {"error": "Database error while adding investment"}

        # Auto-create expense transaction for all types EXCEPT realestate
        tx_amount_usd = invested if invested and invested > 0 else 0
        if tx_amount_usd > 0 and args.asset_type != "realestate":
            supabase.table("transactions").insert({
                "user_id": user_id,
                "amount": tx_amount_usd,
                "currency": "USD",
                "amount_usd": tx_amount_usd,
                "rate_at_entry": 1.0,
                "type": "expense",
                "category": "investment_transfer",
                "description": f"Inv: {args.name[:40]}",
                "date": date_str,
            }).execute()

        logger.info(
            "Investment added to %s: %s", table, response.data[0].get("id"),
            extra={
                "audit": True,
                "action": "add_investment",
                "user_id": user_id,
                "asset_type": args.asset_type,
            },
        )
        return {"success": True, "message": "Investment added successfully", "investment": response.data[0]}
    except Exception as e:
        logger.error("Error adding investment to %s: %s", table, e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def get_investments(supabase, user_id: str, args: GetInvestmentsArgs) -> dict:
    results = []
    types_to_query = [args.asset_type] if args.asset_type else ASSET_TYPES

    try:
        for at in types_to_query:
            tbl = _get_inv_table(at)
            resp = supabase.table(tbl).select("*").eq("user_id", user_id).execute()
            if not hasattr(resp, "data"):
                continue
            for row in resp.data:
                results.append(normalize_investment(at, row))

        results.sort(key=lambda x: x.get("current_value", 0), reverse=True)
        return {"investments": results}
    except Exception as e:
        logger.error("Error fetching investments: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def update_investment(supabase, user_id: str, args: UpdateInvestmentArgs, user_currency: str = "USD") -> dict:
    from app.services.transaction_service import _resolve_timestamp, resolve_currency

    table = _get_inv_table(args.asset_type)
    updates: dict = {}

    cur = (args.currency or user_currency or "USD").upper()
    currency_changed = args.currency is not None

    def _resolve(amount: float, currency: str) -> tuple[float, float, float]:
        return resolve_currency(amount, currency, user_currency, supabase)

    # Common fields (Group A, fund, Group B all share these)
    if args.name is not None:
        updates["name"] = args.name
    if args.date is not None:
        updates["date"] = _resolve_timestamp(args.date)
    if args.ticker is not None:
        updates["ticker"] = args.ticker.upper()

    # Group A — buy_price, current_price, quantity (all 4 types use same columns)
    if args.asset_type in PRICE_FETCH_TYPES:
        if args.quantity is not None:
            updates["quantity"] = args.quantity
        if args.buy_price is not None:
            bp_orig, bp_usd, rate = _resolve(args.buy_price, cur)
            updates["buy_price"] = bp_orig
            updates["buy_price_usd"] = bp_usd
            if currency_changed:
                updates["rate_at_entry"] = rate
                updates["currency"] = cur
        if args.current_price is not None:
            cp_orig, cp_usd, _ = _resolve(args.current_price, cur)
            updates["current_price"] = cp_orig
            updates["current_price_usd"] = cp_usd

    # Fund — quantity, buy_price, current_value, ter
    elif args.asset_type == "fund":
        if args.quantity is not None:
            updates["quantity"] = args.quantity
        if args.buy_price is not None:
            bp_orig, bp_usd, rate = _resolve(args.buy_price, cur)
            updates["buy_price"] = bp_orig
            updates["buy_price_usd"] = bp_usd
            if currency_changed:
                updates["rate_at_entry"] = rate
                updates["currency"] = cur
        if args.current_value is not None:
            cv_orig, cv_usd, rate = _resolve(args.current_value, cur)
            updates["current_value"] = cv_orig
            updates["current_value_usd"] = cv_usd
            if currency_changed and "rate_at_entry" not in updates:
                updates["rate_at_entry"] = rate
        if args.ter is not None:
            updates["ter"] = args.ter

    # Group B unified — quantity replaces principal/capital, apy replaces interest_rate
    elif args.asset_type in GROUP_B_TYPES:
        if args.quantity is not None:
            q_orig, q_usd, rate = _resolve(args.quantity, cur)
            updates["quantity"] = q_orig
            updates["quantity_usd"] = q_usd
            if currency_changed:
                updates["rate_at_entry"] = rate
                updates["currency"] = cur
        if args.apy is not None:
            updates["apy"] = args.apy
        if args.frequency is not None:
            updates["frequency"] = args.frequency
        if args.accumulated_interest is not None:
            ai_orig, ai_usd, _ = _resolve(args.accumulated_interest, cur)
            updates["accumulated_interest"] = ai_orig
            updates["accumulated_interest_usd"] = ai_usd
        if args.reinvest is not None:
            updates["reinvest"] = args.reinvest
        if args.start_date is not None:
            updates["start_date"] = args.start_date
        if args.end_date is not None:
            updates["end_date"] = args.end_date

    # Real estate — all monetary fields + rent_start_date logic
    elif args.asset_type == "realestate":
        if args.estimated_value is not None:
            ev_orig, ev_usd, rate = _resolve(args.estimated_value, cur)
            updates["estimated_value"] = ev_orig
            updates["estimated_value_usd"] = ev_usd
            if currency_changed:
                updates["rate_at_entry"] = rate
                updates["currency"] = cur
        if args.pending_mortgage is not None:
            pm_orig, pm_usd, _ = _resolve(args.pending_mortgage, cur)
            updates["pending_mortgage"] = pm_orig
            updates["pending_mortgage_usd"] = pm_usd
        if args.monthly_rent is not None:
            if args.monthly_rent > 0:
                mr_orig, mr_usd, _ = _resolve(args.monthly_rent, cur)
                updates["monthly_rent"] = mr_orig
                updates["monthly_rent_usd"] = mr_usd
                # Set rent_start_date on first non-zero rent (only if not already set)
                existing = (
                    supabase.table(table)
                    .select("monthly_rent, rent_start_date")
                    .eq("short_id", args.investment_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                if hasattr(existing, "data") and existing.data:
                    row = existing.data[0]
                    prev_rent = row.get("monthly_rent") or 0
                    if not prev_rent and not row.get("rent_start_date"):
                        updates["rent_start_date"] = datetime.date.today().isoformat()
            else:
                updates["monthly_rent"] = 0
                updates["monthly_rent_usd"] = 0
                updates["rent_start_date"] = None
        if args.purchase_price is not None:
            pp_orig, pp_usd, _ = _resolve(args.purchase_price, cur)
            updates["purchase_price"] = pp_orig
            updates["purchase_price_usd"] = pp_usd

    # Forex — quantity replaces amount
    elif args.asset_type == "forex":
        if args.quantity is not None:
            q_orig, q_usd, rate = _resolve(args.quantity, cur)
            updates["quantity"] = q_orig
            updates["quantity_usd"] = q_usd
            if currency_changed:
                updates["rate_at_entry"] = rate
                updates["currency"] = cur

    # Currency update (applies to any type if not already set)
    if args.currency is not None and "currency" not in updates:
        updates["currency"] = cur

    if not updates:
        return {"status": "error", "message": "No fields to update were provided."}

    try:
        response = (
            supabase.table(table)
            .update(updates)
            .eq("short_id", args.investment_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Investment updated in %s: %s", table, args.investment_id,
                extra={
                    "audit": True,
                    "action": "update_investment",
                    "user_id": user_id,
                    "investment_id": args.investment_id,
                    "updates": list(updates.keys()),
                },
            )
            return {"status": "success", "message": "Investment updated successfully", "investment": response.data[0]}
        return {"status": "error", "message": f"Investment {args.investment_id} not found in {table}"}
    except Exception as e:
        logger.error("Error updating investment %s in %s: %s", args.investment_id, table, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


def delete_investment(supabase, user_id: str, args: DeleteInvestmentArgs) -> dict:
    table = _get_inv_table(args.asset_type)
    try:
        response = (
            supabase.table(table)
            .delete()
            .eq("short_id", args.investment_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Investment deleted from %s: %s", table, args.investment_id,
                extra={
                    "audit": True,
                    "action": "delete_investment",
                    "user_id": user_id,
                    "investment_id": args.investment_id,
                },
            )
            return {"status": "success", "message": f"Investment {args.investment_id} deleted successfully"}
        return {"status": "error", "message": f"Investment {args.investment_id} not found in {table}"}
    except Exception as e:
        logger.error("Error deleting investment %s from %s: %s", args.investment_id, table, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


async def sell_investment(supabase, user_id: str, args: SellInvestmentArgs, language: str, user_currency: str) -> dict:
    """Sell (partially or fully) an investment position."""
    from app.services.price_service import fetch_current_price
    from app.services.transaction_service import _resolve_timestamp

    table = _get_inv_table(args.asset_type)
    date_str = _resolve_timestamp(None)

    try:
        resp = (
            supabase.table(table)
            .select("*")
            .eq("short_id", args.investment_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not hasattr(resp, "data") or len(resp.data) == 0:
            return {"error": f"Investment {args.investment_id} not found in {table}"}

        row = resp.data[0]
        inv_id = row["id"]

        if args.asset_type in PRICE_FETCH_TYPES:
            held_qty = float(row.get("quantity", 0))
            sell_qty = args.quantity if args.quantity is not None else held_qty
            if sell_qty > held_qty:
                return {"error": f"Cannot sell {sell_qty} — only {held_qty} held."}
            sale_price = args.sale_price
            if sale_price is None:
                if row.get("ticker"):
                    try:
                        sale_price = await asyncio.wait_for(
                            fetch_current_price(row["ticker"], args.asset_type),
                            timeout=8.0,
                        )
                    except asyncio.TimeoutError:
                        pass
                if sale_price is None:
                    sale_price = float(row.get("current_price") or row.get("buy_price", 0))
            proceeds = sell_qty * sale_price
            is_full_sale = sell_qty >= held_qty

        elif args.asset_type == "fund":
            proceeds = args.sale_price or float(row.get("current_value") or (row.get("quantity", 0) * row.get("buy_price", 0)))
            is_full_sale = True

        elif args.asset_type in GROUP_B_TYPES:
            qty = float(row.get("quantity", 0))
            apy = float(row.get("apy", 0))
            frequency = row.get("frequency", "monthly")
            start_date = row.get("start_date", date_str)
            accrued = calc_compound_interest(qty, apy, frequency, start_date)
            proceeds = args.sale_price or (qty + accrued)
            is_full_sale = True

        elif args.asset_type == "realestate":
            # Real estate sale does NOT create investment_return transaction
            supabase.table(table).delete().eq("id", inv_id).eq("user_id", user_id).execute()
            logger.info(
                "Real estate sold/deleted: %s", args.investment_id,
                extra={"audit": True, "action": "sell_investment", "user_id": user_id},
            )
            return {
                "success": True,
                "message": "Real estate position removed. No balance transaction created (equity was tracked separately).",
                "full_sale": True,
            }

        elif args.asset_type == "forex":
            proceeds = args.sale_price or float(row.get("quantity", 0))
            is_full_sale = True

        else:
            return {"error": f"Unknown asset type: {args.asset_type}"}

        name = row.get("name") or row.get("ticker") or "Investment"
        if is_full_sale:
            supabase.table(table).delete().eq("id", inv_id).eq("user_id", user_id).execute()
        else:
            supabase.table(table).update({"quantity": held_qty - sell_qty}).eq("id", inv_id).eq("user_id", user_id).execute()

        if proceeds > 0:
            desc_prefix = "Sold: " if language != "es" else "Vendido: "
            supabase.table("transactions").insert({
                "user_id": user_id,
                "amount": round(proceeds, 2),
                "currency": "USD",
                "amount_usd": round(proceeds, 2),
                "rate_at_entry": 1.0,
                "type": "income",
                "category": "investment_return",
                "description": f"{desc_prefix}{str(name)[:40]}",
                "date": date_str,
            }).execute()

        logger.info(
            "Investment sold from %s: %s (full=%s, proceeds=%.2f)",
            table, args.investment_id, is_full_sale, proceeds,
            extra={"audit": True, "action": "sell_investment", "user_id": user_id},
        )
        return {
            "success": True,
            "message": f"{'Fully' if is_full_sale else 'Partially'} sold {name} for {proceeds:.2f}. Income transaction recorded.",
            "proceeds": round(proceeds, 2),
            "full_sale": is_full_sale,
        }
    except Exception as e:
        logger.error("Error selling investment %s from %s: %s", args.investment_id, table, e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


async def get_market_price(user_id: str, ticker: str, asset_type: str) -> dict:
    """Fetch current market price for a ticker (read-only)."""
    from app.services.price_service import fetch_current_price, get_ticker_currency, _TICKER_ALIASES

    try:
        price = await asyncio.wait_for(
            fetch_current_price(ticker, asset_type),
            timeout=8.0,
        )
        if price is not None:
            normalized = ticker.upper().strip()
            resolved_symbol = _TICKER_ALIASES.get(normalized, normalized)
            if asset_type == "crypto":
                resolved_symbol = f"{normalized}-USD" if not normalized.endswith("-USD") else normalized
            currency = get_ticker_currency(resolved_symbol)
            return {
                "ticker": ticker.upper(),
                "asset_type": asset_type,
                "price": price,
                "currency": currency,
            }
        return {"error": f"Could not fetch price for {ticker.upper()}. The ticker may be invalid or the service unavailable."}
    except asyncio.TimeoutError:
        return {"error": f"Price fetch timed out for {ticker.upper()}."}
    except Exception as e:
        logger.error("Error fetching market price for %s: %s", ticker, e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


async def update_all_investment_prices(supabase, user_id: str) -> dict:
    """Fetch and update current prices for all Group A assets (stock/crypto/etf/commodity)."""
    from app.services.price_service import fetch_current_price, get_ticker_currency, _TICKER_ALIASES
    from app.services.transaction_service import resolve_currency

    try:
        updated_list: list = []
        failed_list: list = []
        semaphore = asyncio.Semaphore(5)

        work_items: list[tuple[str, str, dict]] = []
        for asset_type in PRICE_FETCH_TYPES:
            table = ASSET_TABLE_MAP.get(asset_type)
            if not table:
                continue
            resp = supabase.table(table).select("*").eq("user_id", user_id).execute()
            if not hasattr(resp, "data") or not resp.data:
                continue
            for item in resp.data:
                if not item.get("ticker"):
                    continue
                if item.get("skip_price_update"):
                    logger.debug("Skipping price update for %s (skip_price_update=True)", item["ticker"])
                    continue
                work_items.append((asset_type, table, item))

        async def _fetch_and_update(asset_type: str, table: str, item: dict) -> None:
            ticker = item["ticker"]
            async with semaphore:
                try:
                    current_price = await fetch_current_price(ticker, asset_type)
                    if current_price is not None:
                        normalized = ticker.upper().strip()
                        resolved_symbol = _TICKER_ALIASES.get(normalized, normalized)
                        price_currency = get_ticker_currency(resolved_symbol)

                        if price_currency == "USD":
                            price_usd = current_price
                        else:
                            _, price_usd, _ = resolve_currency(current_price, price_currency, "USD", supabase)

                        supabase.table(table).update({
                            "current_price": current_price,
                            "current_price_usd": price_usd,
                        }).eq("id", item["id"]).execute()
                        updated_list.append({
                            "ticker": ticker,
                            "price": current_price,
                            "price_currency": price_currency,
                            "price_usd": price_usd,
                        })
                    else:
                        failed_list.append({"ticker": ticker, "reason": "no_price_returned"})
                except Exception as loop_e:
                    logger.warning("Failed to fetch price for %s: %s", ticker, loop_e)
                    failed_list.append({"ticker": ticker, "reason": str(loop_e)})

        await asyncio.gather(*[_fetch_and_update(at, tbl, item) for at, tbl, item in work_items])

        return {
            "status": "success",
            "updated": updated_list,
            "failed": failed_list,
            "success_count": len(updated_list),
            "fail_count": len(failed_list),
            "message": f"Updated {len(updated_list)} assets. {len(failed_list)} failed.",
        }
    except Exception as e:
        logger.error("Error updating all investment prices: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}
