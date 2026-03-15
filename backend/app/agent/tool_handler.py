"""Tool dispatcher — validates args and delegates to domain services."""
import hashlib
import json
import logging
import time
from collections import defaultdict

from pydantic import ValidationError
from google.genai import types

from app.services.supabase_client import get_supabase_client
from app.models import (
    AddTransactionArgs, GetBalanceArgs, GetTransactionsArgs,
    GetSpendingSummaryArgs, DeleteTransactionArgs, UpdateTransactionArgs,
    AddInvestmentArgs, GetInvestmentsArgs, UpdateInvestmentArgs,
    DeleteInvestmentArgs, SellInvestmentArgs,
    AddBudgetArgs, UpdateBudgetArgs, DeleteBudgetArgs, GetBudgetHistoryArgs,
    AddSavingsPotArgs, UpdateSavingsPotArgs, DeleteSavingsPotArgs,
    AddSavingsContributionArgs, WithdrawFromSavingsArgs,
    GetMarketPriceArgs, GetAllCategoriesArgs, GetExchangeRatesArgs,
    UpdateAllInvestmentPricesArgs, SearchTransactionsArgs,
    GetFinancialSummaryArgs, GetChartDataArgs,
)
import app.services.transaction_service as tx_svc
import app.services.investment_service as inv_svc
import app.services.budget_service as budget_svc
import app.services.savings_service as savings_svc
import app.services.metrics_service as metrics_svc

# Re-export for backward compat (main.py snapshot endpoint uses these)
from app.services.investment_service import normalize_investment as _normalize_investment  # noqa: F401

logger = logging.getLogger("finvoice.tools")

# Deduplication cache: user_id → {tool_signature → (result, timestamp)}
# Prevents Gemini from accidentally executing the same mutation twice within TTL.
_DEDUP_CACHE: dict[str, dict[str, tuple[dict, float]]] = defaultdict(dict)
_DEDUP_TTL = 30.0  # seconds


def _dedup_key(tool_name: str, args: dict) -> str:
    payload = json.dumps({"t": tool_name, "a": args}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _dedup_check(user_id: str, key: str) -> dict | None:
    """Return cached result if within TTL, else None."""
    entry = _DEDUP_CACHE[user_id].get(key)
    if entry and (time.monotonic() - entry[1]) < _DEDUP_TTL:
        return entry[0]
    return None


def _dedup_store(user_id: str, key: str, result: dict) -> None:
    _DEDUP_CACHE[user_id][key] = (result, time.monotonic())


# Tools that modify data and require a metrics refresh after execution
_MUTATION_TOOLS = {
    "add_transaction", "update_transaction", "delete_transaction",
    "add_investment", "update_investment", "delete_investment", "sell_investment",
    "update_all_investment_prices",
    "add_budget", "update_budget", "delete_budget",
    "add_savings_pot", "update_savings_pot", "delete_savings_pot",
    "add_savings_contribution", "withdraw_from_savings",
}


async def execute_tool_call(
    tool_call,
    user_id: str,
    language: str = "en",
    user_currency: str = "USD",
) -> list[types.FunctionResponse]:
    """Execute Gemini tool calls and return FunctionResponse objects."""
    responses = []
    supabase = get_supabase_client()

    for function_call in tool_call.function_calls:
        name = function_call.name
        args = dict(function_call.args) if function_call.args else {}
        call_id = getattr(function_call, "id", None)
        result = None

        # Deduplication: skip re-execution of the same mutation within TTL
        if name in _MUTATION_TOOLS:
            dk = _dedup_key(name, args)
            cached = _dedup_check(user_id, dk)
            if cached is not None:
                logger.info("[DEDUP] %s blocked (duplicate within %ss) for user %s", name, _DEDUP_TTL, user_id)
                responses.append(types.FunctionResponse(name=name, response=cached, id=call_id))
                continue

        try:
            # ── Transactions ──────────────────────────────────────────────
            if name == "add_transaction":
                v = AddTransactionArgs.model_validate(args)
                result = tx_svc.add_transaction(supabase, user_id, v, user_currency)

            elif name == "get_balance":
                v = GetBalanceArgs.model_validate(args)
                result = tx_svc.get_balance(supabase, user_id, v)

            elif name == "get_transactions":
                v = GetTransactionsArgs.model_validate(args)
                result = tx_svc.get_transactions(supabase, user_id, v)

            elif name == "get_spending_summary":
                v = GetSpendingSummaryArgs.model_validate(args)
                result = tx_svc.get_spending_summary(supabase, user_id, v)

            elif name == "delete_transaction":
                v = DeleteTransactionArgs.model_validate(args)
                result = tx_svc.delete_transaction(supabase, user_id, v)

            elif name == "update_transaction":
                v = UpdateTransactionArgs.model_validate(args)
                result = tx_svc.update_transaction(supabase, user_id, v, user_currency)

            # ── Budgets ───────────────────────────────────────────────────
            elif name == "add_budget":
                v = AddBudgetArgs.model_validate(args)
                result = budget_svc.add_budget(supabase, user_id, v, user_currency)

            elif name == "get_budgets":
                result = budget_svc.get_budgets(supabase, user_id)

            elif name == "update_budget":
                v = UpdateBudgetArgs.model_validate(args)
                result = budget_svc.update_budget(supabase, user_id, v, user_currency)

            elif name == "delete_budget":
                v = DeleteBudgetArgs.model_validate(args)
                result = budget_svc.delete_budget(supabase, user_id, v)

            elif name == "get_budget_history":
                GetBudgetHistoryArgs.model_validate(args)
                result = budget_svc.get_budget_history(supabase, user_id)

            # ── Investments ───────────────────────────────────────────────
            elif name == "add_investment":
                v = AddInvestmentArgs.model_validate(args)
                result = await inv_svc.add_investment(supabase, user_id, v, language, user_currency)

            elif name == "get_investments":
                v = GetInvestmentsArgs.model_validate(args)
                result = inv_svc.get_investments(supabase, user_id, v)

            elif name == "update_investment":
                v = UpdateInvestmentArgs.model_validate(args)
                result = inv_svc.update_investment(supabase, user_id, v, user_currency)

            elif name == "delete_investment":
                v = DeleteInvestmentArgs.model_validate(args)
                result = inv_svc.delete_investment(supabase, user_id, v)

            elif name == "sell_investment":
                v = SellInvestmentArgs.model_validate(args)
                result = await inv_svc.sell_investment(supabase, user_id, v, language, user_currency)

            elif name == "get_market_price":
                v = GetMarketPriceArgs.model_validate(args)
                result = await inv_svc.get_market_price(user_id, v.ticker, v.asset_type)

            elif name == "update_all_investment_prices":
                UpdateAllInvestmentPricesArgs.model_validate(args)
                result = await inv_svc.update_all_investment_prices(supabase, user_id)

            # ── Savings Pots ──────────────────────────────────────────────
            elif name == "add_savings_pot":
                v = AddSavingsPotArgs.model_validate(args)
                result = savings_svc.add_savings_pot(supabase, user_id, v, user_currency)

            elif name == "get_savings_pots":
                result = savings_svc.get_savings_pots(supabase, user_id)

            elif name == "update_savings_pot":
                v = UpdateSavingsPotArgs.model_validate(args)
                result = savings_svc.update_savings_pot(supabase, user_id, v, user_currency)

            elif name == "delete_savings_pot":
                v = DeleteSavingsPotArgs.model_validate(args)
                result = savings_svc.delete_savings_pot(supabase, user_id, v)

            elif name == "add_savings_contribution":
                v = AddSavingsContributionArgs.model_validate(args)
                result = savings_svc.add_savings_contribution(supabase, user_id, v, language, user_currency)

            elif name == "withdraw_from_savings":
                v = WithdrawFromSavingsArgs.model_validate(args)
                result = savings_svc.withdraw_from_savings(supabase, user_id, v, language, user_currency)

            # ── Utility ───────────────────────────────────────────────────
            elif name == "get_all_categories":
                GetAllCategoriesArgs.model_validate(args)
                result = tx_svc.get_all_categories(supabase, user_id)

            elif name == "search_transactions":
                validated = SearchTransactionsArgs.model_validate(args)
                result = tx_svc.search_transactions(
                    supabase,
                    user_id,
                    query=validated.query,
                    category=validated.category,
                    limit=validated.limit,
                )

            elif name == "get_exchange_rates":
                GetExchangeRatesArgs.model_validate(args)
                result = savings_svc.get_exchange_rates(supabase, user_id)

            # ── Metrics (new) ─────────────────────────────────────────────
            elif name == "get_financial_summary":
                GetFinancialSummaryArgs.model_validate(args)
                result = metrics_svc.get_financial_summary(supabase, user_id, user_currency)

            elif name == "get_chart_data":
                v = GetChartDataArgs.model_validate(args)
                result = metrics_svc.get_chart_data(supabase, user_id, v.chart_type, user_currency)

            else:
                result = {"error": f"Unknown tool: {name}"}

        except ValidationError as e:
            logger.warning("Tool %s validation error: %s", name, e, extra={"user_id": user_id})
            result = {"error": f"Invalid arguments: {e.errors(include_url=False)}"}
        except Exception as e:
            logger.error("Tool %s execution error: %s", name, e, extra={"user_id": user_id}, exc_info=True)
            result = {"error": f"Internal processing error occurred: {str(e)}"}

        # Store successful mutation results in dedup cache
        if name in _MUTATION_TOOLS and result and "error" not in result:
            _dedup_store(user_id, dk, result)  # type: ignore[possibly-undefined]

        responses.append(types.FunctionResponse(
            name=name,
            response=result,
            id=call_id,
        ))

    # NOTE: Do NOT refresh metrics here. Instead, live_agent.py sets _turn_had_mutation = True
    # and calls refresh_user_metrics() ONCE at turn_complete (not per-tool).
    # This prevents O(N) repeated calculations when multiple tools run in one turn.
    # See: live_agent.py line 570-571 (turn_complete handler)
    # If you need metrics to refresh even on read-only queries, modify live_agent.py's
    # turn_complete logic instead of adding refresh calls here.

    return responses
