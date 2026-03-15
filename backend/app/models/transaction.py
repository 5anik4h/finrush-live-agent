import datetime
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Accepts: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (agent can pass time extracted from an image)
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")

def _validate_date_or_datetime(v):
    """Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM. Rejects anything else."""
    if v is None:
        return None
    if not _DATE_PATTERN.match(v):
        raise ValueError(f"date must be YYYY-MM-DD or YYYY-MM-DDTHH:MM, got: {v!r}")
    # Validate the date part is a real calendar date
    try:
        datetime.date.fromisoformat(v[:10])
    except ValueError:
        raise ValueError(f"Invalid date: {v!r}")
    return v


class AddTransactionArgs(BaseModel):
    amount: float = Field(..., gt=0, lt=1_000_000, description="Transaction amount (positive)")
    type: Literal["income", "expense"]
    category: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9\s\-_À-ÿ]+$")
    description: str = Field("", max_length=50)
    date: Optional[str] = None
    currency: str | None = None

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return _validate_date_or_datetime(v)


class GetBalanceArgs(BaseModel):
    period: Literal["all time", "this month"] = "all time"
    date_from: Optional[str] = None
    date_to: Optional[str] = None

    @field_validator("date_from", "date_to", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v[:10])
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v[:10]  # Always strip time for range filters


class GetTransactionsArgs(BaseModel):
    limit: int = Field(10, ge=1, le=100)
    category: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

    @field_validator("date_from", "date_to", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v[:10])
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v[:10]


class GetSpendingSummaryArgs(BaseModel):
    period: Literal["this month", "all time"] = "this month"
    date_from: Optional[str] = None
    date_to: Optional[str] = None

    @field_validator("date_from", "date_to", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None:
            return None
        try:
            datetime.date.fromisoformat(v[:10])
        except ValueError:
            raise ValueError(f"date must be ISO format (YYYY-MM-DD), got: {v!r}")
        return v[:10]


class DeleteTransactionArgs(BaseModel):
    transaction_id: int


class UpdateTransactionArgs(BaseModel):
    transaction_id: int
    amount: float | None = Field(None, gt=0, lt=1_000_000)
    type: Literal["income", "expense"] | None = None
    category: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=50)
    date: str | None = None
    currency: str | None = None

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return _validate_date_or_datetime(v)
