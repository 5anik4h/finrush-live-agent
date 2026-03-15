"""Savings domain service — all Supabase queries for savings pots and contributions."""
import datetime
import logging
import random

from app.models.savings import (
    AddSavingsPotArgs,
    UpdateSavingsPotArgs,
    DeleteSavingsPotArgs,
    AddSavingsContributionArgs,
    WithdrawFromSavingsArgs,
)

logger = logging.getLogger("finvoice.tools")


def _resolve_timestamp(date_input: str | None) -> str:
    """Resolve date to full TIMESTAMPTZ string. See transaction_service._resolve_timestamp for rules."""
    now = datetime.datetime.now(datetime.timezone.utc)
    if date_input is None:
        return now.isoformat()
    if "T" in date_input:
        return date_input + ":00+00:00"
    today_str = now.date().isoformat()
    if date_input == today_str:
        return now.isoformat()
    rnd_hour = random.randint(11, 22)
    rnd_minute = random.randint(0, 59)
    return f"{date_input}T{rnd_hour:02d}:{rnd_minute:02d}:00+00:00"


def _update_pot_balance_usd(supabase, pot_id: str, user_id: str) -> None:
    """Recalculate and update current_balance_usd on the pot after a contribution change."""
    try:
        resp = (
            supabase.table("savings_contributions")
            .select("amount_usd, amount")
            .eq("pot_id", pot_id)
            .eq("user_id", user_id)
            .execute()
        )
        total = sum(
            float(r.get("amount_usd") or r.get("amount", 0))
            for r in (resp.data or [])
        )
        supabase.table("savings_pots").update({"current_balance_usd": total}).eq("id", pot_id).execute()
    except Exception as e:
        logger.warning("Failed to update current_balance_usd for pot %s: %s", pot_id, e)


def add_savings_pot(supabase, user_id: str, args: AddSavingsPotArgs, user_currency: str) -> dict:
    from app.services.transaction_service import resolve_currency

    currency = (getattr(args, "currency", None) or user_currency or "USD").upper()

    data: dict = {
        "user_id": user_id,
        "name": args.name,
        "currency": currency,
    }
    if args.target_amount is not None:
        ta_orig, ta_usd, rate = resolve_currency(args.target_amount, currency, user_currency, supabase)
        data["target_amount"] = ta_orig
        data["target_amount_usd"] = ta_usd
        data["rate_at_entry"] = rate

    if getattr(args, "initial_amount", None):
        ia_orig, ia_usd, rate = resolve_currency(args.initial_amount, currency, user_currency, supabase)
        data["current_balance"] = ia_orig
        data["current_balance_usd"] = ia_usd
        if "rate_at_entry" not in data:
            data["rate_at_entry"] = rate

    try:
        response = supabase.table("savings_pots").insert(data).execute()
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Savings pot created: %s", response.data[0].get("id"),
                extra={"audit": True, "action": "add_savings_pot", "user_id": user_id},
            )
            return {"success": True, "message": "Savings pot created successfully", "pot": response.data[0]}
        return {"error": "Database error while creating savings pot"}
    except Exception as e:
        logger.error("Error creating savings pot: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def get_savings_pots(supabase, user_id: str) -> dict:
    try:
        response = (
            supabase.table("savings_pots")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        pots = response.data if hasattr(response, "data") else []

        # Fetch last 5 contributions per pot
        for pot in pots:
            contrib_resp = (
                supabase.table("savings_contributions")
                .select("id, short_id, amount, amount_usd, currency, note, date, created_at, updated_at")
                .eq("pot_id", pot["id"])
                .eq("user_id", user_id)
                .order("date", desc=True)
                .limit(5)
                .execute()
            )
            pot["recent_contributions"] = contrib_resp.data if hasattr(contrib_resp, "data") else []

        return {"pots": pots}
    except Exception as e:
        logger.error("Error fetching savings pots: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def update_savings_pot(supabase, user_id: str, args: UpdateSavingsPotArgs, user_currency: str = "USD") -> dict:
    from app.services.transaction_service import resolve_currency

    updates: dict = {}
    if args.name is not None:
        updates["name"] = args.name
    if args.target_amount is not None and args.target_amount > 0:
        currency = (getattr(args, "currency", None) or user_currency or "USD").upper()
        ta_orig, ta_usd, rate = resolve_currency(args.target_amount, currency, user_currency, supabase)
        updates["target_amount"] = ta_orig
        updates["target_amount_usd"] = ta_usd
        updates["currency"] = currency
        updates["rate_at_entry"] = rate

    if not updates:
        return {"status": "error", "message": "No fields to update were provided."}

    updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Resolve ID
    try:
        short_id = int(args.pot_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.pot_id

    try:
        response = (
            supabase.table("savings_pots")
            .update(updates)
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Savings pot updated: %s", args.pot_id,
                extra={"audit": True, "action": "update_savings_pot", "user_id": user_id},
            )
            return {"status": "success", "message": "Savings pot updated successfully", "pot": response.data[0]}
        return {"status": "error", "message": f"Savings pot {args.pot_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error updating savings pot %s: %s", args.pot_id, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


def delete_savings_pot(supabase, user_id: str, args: DeleteSavingsPotArgs) -> dict:
    # Resolve ID
    try:
        short_id = int(args.pot_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.pot_id

    try:
        response = (
            supabase.table("savings_pots")
            .delete()
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Savings pot deleted: %s", args.pot_id,
                extra={"audit": True, "action": "delete_savings_pot", "user_id": user_id},
            )
            return {"status": "success", "message": "Savings pot deleted successfully (contributions also removed)"}
        return {"status": "error", "message": f"Savings pot {args.pot_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error deleting savings pot %s: %s", args.pot_id, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


def add_savings_contribution(supabase, user_id: str, args: AddSavingsContributionArgs, language: str, user_currency: str) -> dict:
    from app.services.transaction_service import resolve_currency

    date_str = _resolve_timestamp(args.date)
    currency = (getattr(args, "currency", None) or user_currency or "USD").upper()

    # Resolve ID
    try:
        short_id = int(args.pot_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.pot_id

    try:
        # Verify pot exists and belongs to user
        pot_resp = (
            supabase.table("savings_pots")
            .select("id, name, short_id")
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        pot = pot_resp.data[0]
        pot_name = pot["name"]
        pot_short_id = pot.get("short_id")

        amt_orig, amt_usd, rate = resolve_currency(abs(args.amount), currency, user_currency, supabase)

        pot_id_uuid = pot_resp.data[0]["id"]

        # Insert contribution (positive amount = deposit)
        contrib_data = {
            "user_id": user_id,
            "pot_id": pot_id_uuid,
            "short_id": pot_short_id,
            "amount": amt_orig,
            "currency": currency,
            "amount_usd": amt_usd,
            "rate_at_entry": rate,
            "note": args.note or f"Deposit to {pot_name}",
            "date": date_str,
        }
        contrib_resp = supabase.table("savings_contributions").insert(contrib_data).execute()
        if not hasattr(contrib_resp, "data") or len(contrib_resp.data) == 0:
            return {"error": "Database error while adding contribution"}

        # Update pot's current_balance_usd
        _update_pot_balance_usd(supabase, pot_id_uuid, user_id)

        # Auto-create expense transaction in Balance (always USD for consistency)
        desc_prefix = "Savings: " if language != "es" else "Ahorro: "
        supabase.table("transactions").insert({
            "user_id": user_id,
            "amount": amt_orig,
            "currency": currency,
            "amount_usd": amt_usd,
            "rate_at_entry": rate,
            "type": "expense",
            "category": "savings_contribution",
            "description": f"{desc_prefix}{pot_name}"[:50],
            "date": date_str,
        }).execute()

        logger.info(
            "Savings contribution added: %s %s to pot %s", amt_orig, currency, args.pot_id,
            extra={"audit": True, "action": "add_savings_contribution", "user_id": user_id},
        )
        return {
            "success": True,
            "message": f"Deposited {amt_orig} {currency} into '{pot_name}'. Balance transaction recorded.",
            "amount_original": amt_orig,
            "currency": currency,
            "amount_usd": amt_usd,
            "contribution": contrib_resp.data[0],
        }
    except Exception as e:
        logger.error("Error adding savings contribution: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def withdraw_from_savings(supabase, user_id: str, args: WithdrawFromSavingsArgs, language: str, user_currency: str) -> dict:
    from app.services.transaction_service import resolve_currency

    date_str = _resolve_timestamp(args.date)
    currency = (getattr(args, "currency", None) or user_currency or "USD").upper()

    # Resolve ID
    try:
        short_id = int(args.pot_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.pot_id

    try:
        # Verify pot exists, belongs to user, and has sufficient balance
        pot_resp = (
            supabase.table("savings_pots")
            .select("id, name, current_balance, current_balance_usd, short_id")
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not hasattr(pot_resp, "data") or len(pot_resp.data) == 0:
            return {"error": f"Savings pot {args.pot_id} not found or does not belong to user"}

        pot = pot_resp.data[0]
        pot_name = pot["name"]
        pot_short_id = pot.get("short_id")
        # Use current_balance_usd for balance check (consistent unit)
        balance_usd = float(pot.get("current_balance_usd") or pot.get("current_balance", 0))

        amt_orig, amt_usd, rate = resolve_currency(args.amount, currency, user_currency, supabase)

        if amt_usd > balance_usd:
            return {
                "error": f"Insufficient balance in '{pot_name}'. "
                         f"Current balance (USD): {balance_usd:.2f}, requested: {amt_usd:.2f} USD"
            }

        pot_id_uuid = pot["id"]

        # Insert contribution (negative amount = withdrawal)
        contrib_data = {
            "user_id": user_id,
            "pot_id": pot_id_uuid,
            "short_id": pot_short_id,
            "amount": -amt_orig,
            "currency": currency,
            "amount_usd": -amt_usd,
            "rate_at_entry": rate,
            "note": args.note or f"Withdrawal from {pot_name}",
            "date": date_str,
        }
        contrib_resp = supabase.table("savings_contributions").insert(contrib_data).execute()
        if not hasattr(contrib_resp, "data") or len(contrib_resp.data) == 0:
            return {"error": "Database error while processing withdrawal"}

        # Update pot's current_balance_usd
        _update_pot_balance_usd(supabase, pot_id_uuid, user_id)

        # Auto-create income transaction in Balance
        desc_prefix = "Withdrawal: " if language != "es" else "Retiro: "
        supabase.table("transactions").insert({
            "user_id": user_id,
            "amount": amt_orig,
            "currency": currency,
            "amount_usd": amt_usd,
            "rate_at_entry": rate,
            "type": "income",
            "category": "savings_withdrawal",
            "description": f"{desc_prefix}{pot_name}"[:50],
            "date": date_str,
        }).execute()

        logger.info(
            "Savings withdrawal: %s %s from pot %s", amt_orig, currency, args.pot_id,
            extra={"audit": True, "action": "withdraw_from_savings", "user_id": user_id},
        )
        return {
            "success": True,
            "message": f"Withdrew {amt_orig} {currency} from '{pot_name}'. Balance transaction recorded.",
            "amount_original": amt_orig,
            "currency": currency,
            "amount_usd": amt_usd,
            "contribution": contrib_resp.data[0],
        }
    except Exception as e:
        logger.error("Error withdrawing from savings: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def get_exchange_rates(supabase, user_id: str) -> dict:
    """Return current exchange rates for USD, EUR, GBP from DB cache."""
    try:
        response = supabase.table("exchange_rates").select("*").in_("currency", ["USD", "EUR", "GBP"]).execute()
        if not hasattr(response, "data"):
            return {"error": "Failed to fetch exchange rates"}
        rates = {row["currency"]: row["rate_vs_usd"] for row in response.data}
        return {"status": "success", "rates": rates}
    except Exception as e:
        logger.error("Error fetching exchange rates: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


async def update_exchange_rates(supabase) -> dict:
    """Fetch fresh rates from frankfurter.app and upsert into exchange_rates table."""
    import httpx

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get("https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP")
            res.raise_for_status()
            data = res.json()
        raw_rates = data.get("rates", {})
        rows = [{"currency": "USD", "rate_vs_usd": 1.0, "updated_at": now}]
        for cur, rate in raw_rates.items():
            rows.append({"currency": cur, "rate_vs_usd": float(rate), "updated_at": now})
        supabase.table("exchange_rates").upsert(rows, on_conflict="currency").execute()
        rates = {row["currency"]: row["rate_vs_usd"] for row in rows}
        return {"status": "success", "message": "Exchange rates updated successfully", "rates": rates, "updated_at": now}
    except httpx.HTTPError as e:
        logger.error("Failed to fetch exchange rates from frankfurter.app: %s", e)
        try:
            resp = supabase.table("exchange_rates").select("*").in_("currency", ["USD", "EUR", "GBP"]).execute()
            rates = {row["currency"]: row["rate_vs_usd"] for row in (resp.data or [])}
            return {"status": "partial", "message": "Could not fetch live rates. Showing cached rates.", "rates": rates}
        except Exception:
            return {"error": "Failed to update exchange rates and no cached rates available."}
    except Exception as e:
        logger.error("Error updating exchange rates: %s", e)
        return {"error": f"An error occurred: {str(e)}"}
