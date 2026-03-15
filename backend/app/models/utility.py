from typing import Optional

from pydantic import BaseModel, Field


class SearchTransactionsArgs(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    limit: int = Field(20, ge=1, le=100)


class GetMarketPriceArgs(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=30)
    asset_type: str # stock, etf, crypto, commodity


class GetAllCategoriesArgs(BaseModel):
    """No parameters required for getting all categories."""
    pass


class AddCategoryArgs(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class DeleteCategoryArgs(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class GetExchangeRatesArgs(BaseModel):
    pass


class UpdateAllInvestmentPricesArgs(BaseModel):
    pass


class UpdateExchangeRatesArgs(BaseModel):
    pass


class GetFinancialSummaryArgs(BaseModel):
    """No parameters required — uses user_id and currency from session context."""
    pass


class GetChartDataArgs(BaseModel):
    chart_type: str = Field(
        ...,
        description=(
            "One of: wealth_evolution, savings_monthly, savings_cumulative, "
            "balance_by_category_expense, balance_by_category_income, "
            "investment_by_type, budget_progress, savings_pot_progress"
        ),
    )
