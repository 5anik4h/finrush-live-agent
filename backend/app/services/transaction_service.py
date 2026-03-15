"""Transaction domain service — all Supabase queries for transactions."""
import datetime
import logging
import random
import unicodedata

from app.models.transaction import (
    AddTransactionArgs,
    GetBalanceArgs,
    GetTransactionsArgs,
    GetSpendingSummaryArgs,
    DeleteTransactionArgs,
    UpdateTransactionArgs,
)

logger = logging.getLogger("finvoice.tools")


def _resolve_timestamp(date_input: str | None) -> str:
    """
    Resolve the timestamp to store in the DB for a transaction/contribution date.

    Rules:
    - No date provided (real-time): use exact UTC now → "YYYY-MM-DDTHH:MM:SS+00:00"
    - Date only "YYYY-MM-DD" (past, no time): assign random time 11:00–23:00 UTC
    - Date+time "YYYY-MM-DDTHH:MM" (from image or explicit): use as-is with :00+00:00 appended
    """
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


def _normalize_category(raw: str) -> str:
    """Lowercase and strip accents from a category string."""
    lower = raw.lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", lower) if unicodedata.category(c) != "Mn"
    )


_FALLBACK_RATES_VS_USD = {"EUR": 1.08, "GBP": 1.27}


def resolve_currency(
    amount: float,
    currency: str | None,
    user_currency: str,
    supabase,
) -> tuple[float, float, float]:
    """Resolve amount into (amount_original, amount_usd, rate_at_entry).

    Pattern A Refined: stores the original amount in the user's currency alongside
    the USD equivalent calculated at the moment of entry. rate_at_entry is fixed
    at save time so historical records never need recalculation.

    Returns:
        (amount_original, amount_usd, rate_at_entry)
        - amount_original: the number exactly as the user entered it
        - amount_usd: amount_original / rate_at_entry
        - rate_at_entry: rate of 1 USD expressed in the original currency (e.g. EUR=1.08 means 1 USD = 1.08 EUR? No: rate_vs_usd means how many of currency per 1 USD)
          Actually exchange_rates.rate_vs_usd stores "how many USD per 1 unit of currency" so EUR rate_vs_usd≈1.08 means 1 EUR = 1.08 USD.
          So amount_usd = amount / rate_vs_usd.
          rate_at_entry stores the rate_vs_usd value used.
    """
    base = (currency or user_currency or "USD").upper()

    if base == "USD":
        return amount, amount, 1.0

    # Try DB-cached rate
    try:
        res = supabase.table("exchange_rates").select("rate_vs_usd").eq("currency", base).execute()
        if res.data:
            rate = float(res.data[0]["rate_vs_usd"])
            return amount, round(amount / rate, 6), rate
    except Exception as e:
        logger.warning("exchange_rates query failed for %s: %s", base, e)

    # Fallback to hardcoded rates
    fallback = _FALLBACK_RATES_VS_USD.get(base)
    if fallback:
        logger.warning("Using fallback rate for %s→USD: %s", base, fallback)
        return amount, round(amount / fallback, 6), fallback

    logger.error("No exchange rate for %s — storing amount_usd = amount (data error)", base)
    return amount, amount, 1.0


def convert_to_usd(amount: float, currency: str | None, user_currency: str, supabase) -> float:
    """Legacy wrapper — returns only amount_usd. Use resolve_currency() for new code."""
    _, amount_usd, _ = resolve_currency(amount, currency, user_currency, supabase)
    return amount_usd


def add_transaction(supabase, user_id: str, args: AddTransactionArgs, user_currency: str) -> dict:
    date_str = _resolve_timestamp(args.date)
    formatted_category = _normalize_category(args.category or "")
    currency = (args.currency or user_currency or "USD").upper()
    amt_orig, amt_usd, rate = resolve_currency(abs(args.amount), currency, user_currency, supabase)

    data = {
        "user_id": user_id,
        "amount": amt_orig,
        "currency": currency,
        "amount_usd": amt_usd,
        "rate_at_entry": rate,
        "type": args.type,
        "category": formatted_category,
        "description": args.description if args.description else "-",
        "date": date_str,
    }

    response = supabase.table("transactions").insert(data).execute()

    if hasattr(response, "data") and len(response.data) > 0:
        logger.info(
            "Transaction added: %s", response.data[0].get("short_id"),
            extra={
                "audit": True,
                "action": "add_transaction",
                "user_id": user_id,
                "amount": amt_orig,
                "currency": currency,
                "amount_usd": amt_usd,
                "category": data["category"],
            },
        )
        return {"success": True, "message": "Transaction added successfully", "transaction": response.data[0]}
    return {"error": "Database error while adding transaction"}


def get_balance(supabase, user_id: str, args: GetBalanceArgs) -> dict:
    # Use amount_usd for consistent aggregation across currencies
    query = supabase.table("transactions").select("amount_usd, type").eq("user_id", user_id)

    if args.date_from:
        query = query.gte("date", args.date_from)
    if args.date_to:
        query = query.lt("date", args.date_to + "T23:59:59.999999+00:00")
    elif not args.date_from and args.period == "this month":
        first_day = datetime.datetime.now(datetime.timezone.utc).replace(day=1).date().isoformat()
        query = query.gte("date", first_day)

    response = query.execute()

    total_income = 0.0
    total_expense = 0.0

    if hasattr(response, "data"):
        for row in response.data:
            # amount_usd may be None for legacy rows — fall back to amount
            amt = float(row.get("amount_usd") or row.get("amount", 0))
            if row.get("type", "").lower() == "income":
                total_income += amt
            else:
                total_expense += amt

    period_label = args.period
    if args.date_from or args.date_to:
        period_label = f"{args.date_from or '...'} to {args.date_to or '...'}"

    return {
        "period": period_label,
        "total_income_usd": total_income,
        "total_expenses_usd": total_expense,
        "current_balance_usd": total_income - total_expense,
        "note": "All values in USD. Agent should convert to user's display currency before reporting.",
    }


def get_transactions(supabase, user_id: str, args: GetTransactionsArgs) -> dict:
    query = supabase.table("transactions").select("*").eq("user_id", user_id)

    if args.category:
        query = query.eq("category", args.category)
    if args.date_from:
        query = query.gte("date", args.date_from)
    if args.date_to:
        query = query.lt("date", args.date_to + "T23:59:59.999999+00:00")

    response = query.order("date", desc=True).limit(args.limit).execute()

    if hasattr(response, "data"):
        return {"transactions": response.data}
    return {"transactions": []}


def get_spending_summary(supabase, user_id: str, args: GetSpendingSummaryArgs) -> dict:
    query = (
        supabase.table("transactions")
        .select("amount_usd, amount, category")
        .eq("user_id", user_id)
        .eq("type", "expense")
    )

    if args.date_from:
        query = query.gte("date", args.date_from)
    if args.date_to:
        query = query.lt("date", args.date_to + "T23:59:59.999999+00:00")
    elif not args.date_from and args.period == "this month":
        first_day = datetime.datetime.now(datetime.timezone.utc).replace(day=1).date().isoformat()
        query = query.gte("date", first_day)

    response = query.execute()

    summary: dict[str, float] = {}
    if hasattr(response, "data"):
        for row in response.data:
            cat = row.get("category", "other")
            amt = float(row.get("amount_usd") or row.get("amount", 0))
            summary[cat] = summary.get(cat, 0.0) + amt

    period_label = args.period
    if args.date_from or args.date_to:
        period_label = f"{args.date_from or '...'} to {args.date_to or '...'}"

    return {
        "period": period_label,
        "spending_by_category_usd": summary,
        "note": "All values in USD.",
    }


def delete_transaction(supabase, user_id: str, args: DeleteTransactionArgs) -> dict:
    try:
        response = (
            supabase.table("transactions")
            .delete()
            .eq("short_id", args.transaction_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Transaction deleted: %s", args.transaction_id,
                extra={
                    "audit": True,
                    "action": "delete_transaction",
                    "user_id": user_id,
                    "transaction_id": args.transaction_id,
                },
            )
            return {"status": "success", "message": f"Successfully deleted transaction {args.transaction_id}"}
        return {"status": "error", "message": f"Transaction {args.transaction_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error deleting transaction %s: %s", args.transaction_id, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}


def update_transaction(supabase, user_id: str, args: UpdateTransactionArgs, user_currency: str) -> dict:
    updates: dict = {}

    if args.amount is not None:
        currency = (args.currency or user_currency or "USD").upper()
        amt_orig, amt_usd, rate = resolve_currency(abs(args.amount), currency, user_currency, supabase)
        updates["amount"] = amt_orig
        updates["currency"] = currency
        updates["amount_usd"] = amt_usd
        updates["rate_at_entry"] = rate
    elif args.currency is not None:
        # Currency changed without changing amount — update currency field only
        updates["currency"] = args.currency.upper()

    if args.type is not None:
        updates["type"] = args.type
    if args.date is not None:
        updates["date"] = _resolve_timestamp(args.date)
    if args.category is not None:
        updates["category"] = _normalize_category(args.category)
    if args.description is not None:
        updates["description"] = args.description

    if not updates:
        return {"status": "error", "message": "No fields to update were provided."}

    try:
        response = (
            supabase.table("transactions")
            .update(updates)
            .eq("short_id", args.transaction_id)
            .eq("user_id", user_id)
            .execute()
        )
        if hasattr(response, "data") and len(response.data) > 0:
            logger.info(
                "Transaction updated: %s", args.transaction_id,
                extra={
                    "audit": True,
                    "action": "update_transaction",
                    "user_id": user_id,
                    "transaction_id": args.transaction_id,
                },
            )
            return {"status": "success", "message": f"Successfully updated transaction {args.transaction_id}", "transaction": response.data[0]}
        return {"status": "error", "message": f"Transaction {args.transaction_id} not found or does not belong to user"}
    except Exception as e:
        logger.error("Error updating transaction %s: %s", args.transaction_id, e, extra={"user_id": user_id})
        return {"status": "error", "message": f"An error occurred: {str(e)}"}



def get_all_categories(supabase, user_id: str) -> dict:
    """Return the list of all system categories with their translated labels."""
    # Hardcoded system categories to match frontend exactly
    # Income
    income = [
        {"value": "salary", "label_en": "Salary/Payroll", "label_es": "Nómina"},
        {"value": "freelance", "label_en": "Freelance/Invoices", "label_es": "Facturas"},
        {"value": "investments", "label_en": "Investments", "label_es": "Inversiones"},
        {"value": "interests", "label_en": "Interests", "label_es": "Intereses"},
        {"value": "dividends", "label_en": "Dividends", "label_es": "Dividendos"},
        {"value": "gifts", "label_en": "Gifts", "label_es": "Regalos"},
        {"value": "sales", "label_en": "Sales", "label_es": "Ventas"},
        {"value": "rental_income", "label_en": "Rental Income", "label_es": "Ingresos por Alquiler"},
        {"value": "awards", "label_en": "Awards", "label_es": "Premios"},
        {"value": "savings_withdrawal", "label_en": "Savings Withdrawal", "label_es": "Retirada de Hucha"},
        {"value": "investment_return", "label_en": "Investment Return", "label_es": "Retorno de Inversión"},
        {"value": "other", "label_en": "Other", "label_es": "Otros"},
    ]
    # Expense
    expense = [
        {"value": "supermarket", "label_en": "Supermarket", "label_es": "Supermercado"},
        {"value": "house", "label_en": "House", "label_es": "Hogar"},
        {"value": "vehicle", "label_en": "Vehicle", "label_es": "Vehículo"},
        {"value": "transport", "label_en": "Transport", "label_es": "Transporte"},
        {"value": "shopping", "label_en": "Shopping", "label_es": "Compras"},
        {"value": "entertainment", "label_en": "Entertainment", "label_es": "Ocio"},
        {"value": "health", "label_en": "Health", "label_es": "Salud"},
        {"value": "snacks", "label_en": "Snacks", "label_es": "Snacks"},
        {"value": "pets", "label_en": "Pets", "label_es": "Mascotas"},
        {"value": "gifts", "label_en": "Gifts", "label_es": "Regalos"},
        {"value": "beauty", "label_en": "Beauty", "label_es": "Belleza"},
        {"value": "education", "label_en": "Education", "label_es": "Educación"},
        {"value": "travel", "label_en": "Travel", "label_es": "Viajes"},
        {"value": "bills", "label_en": "Bills", "label_es": "Facturas"},
        {"value": "restaurants", "label_en": "Restaurants", "label_es": "Restaurantes"},
        {"value": "subscriptions", "label_en": "Subscriptions", "label_es": "Suscripciones"},
        {"value": "taxes", "label_en": "Taxes", "label_es": "Impuestos"},
        {"value": "investment_transfer", "label_en": "Investment Transfer", "label_es": "Traspaso a Inversión"},
        {"value": "savings_contribution", "label_en": "Savings Contribution", "label_es": "Aportación a Hucha"},
        {"value": "other", "label_en": "Other", "label_es": "Otros"},
    ]
    return {"income_categories": income, "expense_categories": expense}


def search_transactions(
    supabase,
    user_id: str,
    query: str,
    category: str | None = None,
    limit: int = 20,
) -> dict:
    """Search transactions by free-text description (case-insensitive partial match)."""
    limit = max(1, min(limit, 100))
    q = (
        supabase.table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .ilike("description", f"%{query}%")
        .order("date", desc=True)
        .limit(limit)
    )
    if category:
        q = q.eq("category", category.lower())
    response = q.execute()
    transactions = response.data if hasattr(response, "data") else []
    return {"transactions": transactions, "count": len(transactions)}
