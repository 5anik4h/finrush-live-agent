import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

ASSET_TABLE_MAP = {
    "stock": "inv_stocks",
    "commodity": "inv_commodities",
    "crypto": "inv_crypto",
    "etf": "inv_etfs",
    "fund": "inv_funds",
    "fixedincome": "inv_fixedincome",
    "crowdlending": "inv_crowdlending",
    "realestate": "inv_realestate",
    "forex": "inv_forex",
    "account": "inv_accounts",
}

ASSET_TYPES = list(ASSET_TABLE_MAP.keys())

# Group A: tradeable assets with live price updates
PRICE_FETCH_TYPES = ["stock", "commodity", "crypto", "etf"]

# Group B: interest-bearing assets (compound interest auto-calculated)
GROUP_B_TYPES = ["fixedincome", "account", "crowdlending"]

AssetTypeLiteral = Literal[
    "stock", "commodity", "crypto", "etf", "fund",
    "fixedincome", "crowdlending", "realestate", "forex", "account"
]


class AddInvestmentArgs(BaseModel):
    asset_type: AssetTypeLiteral
    ticker: str = Field("", max_length=30)
    name: str = Field(..., min_length=1, max_length=100)
    quantity: Optional[float] = Field(None, gt=0)
    buy_price: Optional[float] = Field(None, gt=0)
    total_amount: Optional[float] = Field(None, gt=0)
    currency: str = "USD"
    date: Optional[str] = None
    extra: Optional[dict] = None

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v


class GetInvestmentsArgs(BaseModel):
    asset_type: Optional[str] = None


class UpdateInvestmentArgs(BaseModel):
    investment_id: int = Field(..., gt=0)
    asset_type: AssetTypeLiteral
    # Common to Group A + Fund
    quantity: Optional[float] = Field(None, gt=0)
    buy_price: Optional[float] = Field(None, gt=0)
    current_price: Optional[float] = Field(None, gt=0)
    current_value: Optional[float] = Field(None, ge=0)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    date: Optional[str] = None
    ticker: Optional[str] = Field(None, max_length=30)
    currency: Optional[str] = None
    # Group B unified fields
    apy: Optional[float] = Field(None, ge=0)
    frequency: Optional[str] = None
    accumulated_interest: Optional[float] = Field(None, ge=0)
    reinvest: Optional[bool] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    # Group B monetary (unified: quantity replaces principal/capital)
    # Agent sends 'quantity' for all Group B updates too (principal/capital → quantity)
    # Group C — realestate
    estimated_value: Optional[float] = Field(None, gt=0)
    pending_mortgage: Optional[float] = Field(None, ge=0)
    monthly_rent: Optional[float] = Field(None, ge=0)
    purchase_price: Optional[float] = Field(None, gt=0)
    # Fund-specific
    ter: Optional[float] = Field(None, ge=0)

    @field_validator("date", "start_date", "end_date", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v


class DeleteInvestmentArgs(BaseModel):
    investment_id: int = Field(..., gt=0)
    asset_type: AssetTypeLiteral


class SellInvestmentArgs(BaseModel):
    investment_id: int = Field(..., gt=0)
    asset_type: AssetTypeLiteral
    quantity: Optional[float] = Field(None, gt=0)
    sale_price: Optional[float] = Field(None, gt=0)
