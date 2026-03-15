"""Budget domain service — all Supabase queries for budgets."""
import logging

from app.models.budget import AddBudgetArgs, UpdateBudgetArgs, DeleteBudgetArgs

logger = logging.getLogger("finvoice.tools")


def add_budget(supabase, user_id: str, args: AddBudgetArgs, user_currency: str) -> dict:
    from app.services.transaction_service import resolve_currency

    currency = (args.currency or user_currency or "USD").upper()
    amt_orig, amt_usd, rate = resolve_currency(abs(args.amount), currency, user_currency, supabase)

    data = {
        "user_id": user_id,
        "name": args.name,
        "type": args.type,
        "amount": amt_orig,
        "currency": currency,
        "amount_usd": amt_usd,
        "rate_at_entry": rate,
        "categories": args.categories,
        "date_from": args.date_from,
        "date_to": args.date_to,
        "recurrence": args.recurrence,
    }
    try:
        response = supabase.table("budgets").insert(data).execute()
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Budget added: %s", response.data[0].get("id"),
                extra={"audit": True, "action": "add_budget", "user_id": user_id,
                       "amount": amt_orig, "currency": currency, "amount_usd": amt_usd},
            )
            return {"success": True, "message": "Budget created successfully", "budget": response.data[0]}
        return {"error": "Database error while creating budget"}
    except Exception as e:
        logger.error("Error creating budget: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def get_budgets(supabase, user_id: str) -> dict:
    try:
        response = (
            supabase.table("budgets")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        if hasattr(response, "data"):
            return {"budgets": response.data}
        return {"budgets": []}
    except Exception as e:
        logger.error("Error fetching budgets: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def update_budget(supabase, user_id: str, args: UpdateBudgetArgs, user_currency: str) -> dict:
    from app.services.transaction_service import resolve_currency

    updates: dict = {}
    if args.name is not None:
        updates["name"] = args.name
    if args.amount is not None:
        currency = (args.currency or user_currency or "USD").upper()
        amt_orig, amt_usd, rate = resolve_currency(abs(args.amount), currency, user_currency, supabase)
        updates["amount"] = amt_orig
        updates["currency"] = currency
        updates["amount_usd"] = amt_usd
        updates["rate_at_entry"] = rate
    elif args.currency is not None:
        updates["currency"] = args.currency.upper()
    if args.categories is not None:
        updates["categories"] = args.categories
    if args.date_from is not None:
        updates["date_from"] = args.date_from
    if args.date_to is not None:
        updates["date_to"] = args.date_to
    if args.recurrence is not None:
        updates["recurrence"] = args.recurrence

    if not updates:
        return {"status": "error", "message": "No fields to update were provided."}

    # Resolve ID: try numeric short_id first if it looks like one
    try:
        short_id = int(args.budget_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.budget_id

    try:
        response = (
            supabase.table("budgets")
            .update(updates)
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Budget updated: %s", args.budget_id,
                extra={"audit": True, "action": "update_budget", "user_id": user_id, "budget_id": args.budget_id},
            )
            return {"status": "success", "message": "Budget updated successfully", "budget": response.data[0]}
        return {"status": "error", "message": f"Budget {args.budget_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error updating budget %s: %s", args.budget_id, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


def get_budget_history(supabase, user_id: str) -> dict:
    try:
        response = (
            supabase.table("budgets_history")
            .select("*")
            .eq("user_id", user_id)
            .order("archived_at", desc=True)
            .execute()
        )
        history = response.data if hasattr(response, "data") else []
        return {"history": history}
    except Exception as e:
        logger.error("Error fetching budget history: %s", e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}


def delete_budget(supabase, user_id: str, args: DeleteBudgetArgs) -> dict:
    # Resolve ID: try numeric short_id first if it looks like one
    try:
        short_id = int(args.budget_id)
        res_col = "short_id"
        target_id = short_id
    except (ValueError, TypeError):
        res_col = "id"
        target_id = args.budget_id

    try:
        response = (
            supabase.table("budgets")
            .delete()
            .eq(res_col, target_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Budget deleted: %s", args.budget_id,
                extra={"audit": True, "action": "delete_budget", "user_id": user_id, "budget_id": args.budget_id},
            )
            return {"status": "success", "message": f"Budget {args.budget_id} deleted successfully"}
        return {"status": "error", "message": f"Budget {args.budget_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error deleting budget %s: %s", args.budget_id, e, extra={"user_id": user_id})
        return {"error": f"An error occurred: {str(e)}"}
