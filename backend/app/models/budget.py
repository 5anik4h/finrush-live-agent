import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

class AddBudgetArgs(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    type: Literal["income", "expense"]
    amount: float = Field(..., gt=0, lt=1_000_000_000)
    categories: list[str] = Field(..., min_length=1)
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    recurrence: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = "monthly"
    currency: str | None = None

    @field_validator("date_from", "date_to", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v


class UpdateBudgetArgs(BaseModel):
    budget_id: str = Field(..., min_length=1, max_length=36)
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    amount: Optional[float] = Field(None, gt=0, lt=1_000_000_000)
    categories: Optional[list[str]] = Field(None, min_length=1)
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    recurrence: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    currency: str | None = None

    @field_validator("date_from", "date_to", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v


class DeleteBudgetArgs(BaseModel):
    budget_id: str = Field(..., min_length=1, max_length=36)


class GetBudgetHistoryArgs(BaseModel):
    pass
