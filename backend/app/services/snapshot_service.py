"""Snapshot service — monthly net-worth computation and storage."""
import calendar
import logging
from datetime import datetime, timezone

from app.services.investment_service import normalize_investment
from app.models.investment import ASSET_TABLE_MAP

logger = logging.getLogger("finvoice.tools")


async def generate(supabase, user_id: str, year: int, month: int) -> dict:
    """Compute and upsert a monthly snapshot for the given user/year/month.

    Returns {"success": True, "snapshot": {...}} or {"error": "..."}.
    """
    last_day = calendar.monthrange(year, month)[1]
    end_date = f"{year}-{month:02d}-{last_day:02d}"
    start_date = "2000-01-01"

    try:
        # Balance from transactions up to end of target month — use amount_usd for
        # consistent multi-currency aggregation (dual-storage, Sesión 55).
        tx_resp = (
            supabase.table("transactions")
            .select("amount, amount_usd, type")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lte("date", end_date)
            .execute()
        )
        balance = 0.0
        if hasattr(tx_resp, "data"):
            for row in tx_resp.data:
                # amount_usd preferred; fall back to amount for legacy rows (assumed USD)
                amt = float(row.get("amount_usd") or row.get("amount", 0))
                if row.get("type") == "income":
                    balance += amt
                else:
                    balance -= amt

        # Investment value across all inv_* tables — use current_value_usd (dual-storage)
        inv_value = 0.0
        for asset_type, table in ASSET_TABLE_MAP.items():
            resp = supabase.table(table).select("*").eq("user_id", user_id).execute()
            if hasattr(resp, "data"):
                for row in resp.data:
                    norm = normalize_investment(asset_type, row)
                    # current_value_usd is always populated; current_value may be non-USD
                    inv_value += norm.get("current_value_usd", norm.get("current_value", 0))

        # Savings pots value — include all pots, use current_balance_usd (dual-storage)
        pots_resp = (
            supabase.table("savings_pots")
            .select("current_balance, current_balance_usd")
            .eq("user_id", user_id)
            .execute()
        )
        savings = 0.0
        if hasattr(pots_resp, "data"):
            for pot in pots_resp.data:
                # current_balance_usd preferred; fall back to current_balance for legacy rows
                savings += float(pot.get("current_balance_usd") or pot.get("current_balance", 0))

        net_worth = balance + inv_value + savings

        snapshot = {
            "user_id": user_id,
            "year": year,
            "month": month,
            "balance": round(balance, 2),
            "investment_value": round(inv_value, 2),
            "savings_value": round(savings, 2),
            "net_worth": round(net_worth, 2),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("monthly_snapshots").upsert(
            snapshot,
            on_conflict="user_id,year,month",
        ).execute()

        return {"success": True, "snapshot": snapshot}
    except Exception as e:
        logger.error("Snapshot generation failed for user %s %d-%02d: %s", user_id, year, month, e)
        return {"error": f"Snapshot generation failed: {str(e)}"}
