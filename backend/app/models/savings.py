import datetime
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")

def _validate_date_or_datetime(v):
    if v is None:
        return None
    if not _DATE_PATTERN.match(v):
        raise ValueError(f"date must be YYYY-MM-DD or YYYY-MM-DDTHH:MM, got: {v!r}")
    try:
        datetime.date.fromisoformat(v[:10])
    except ValueError:
        raise ValueError(f"Invalid date: {v!r}")
    return v


class AddSavingsPotArgs(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: Optional[float] = Field(None, gt=0)
    currency: str | None = None


class GetSavingsPotsArgs(BaseModel):
    pass


class UpdateSavingsPotArgs(BaseModel):
    pot_id: str = Field(..., min_length=1, max_length=36)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)  # e.g. EUR, GBP, USD


class DeleteSavingsPotArgs(BaseModel):
    pot_id: str = Field(..., min_length=1, max_length=36)


class AddSavingsContributionArgs(BaseModel):
    pot_id: str = Field(..., min_length=1, max_length=36)
    amount: float = Field(..., gt=0, lt=1_000_000)
    note: str = ""
    date: Optional[str] = None
    currency: str | None = None

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return _validate_date_or_datetime(v)


class WithdrawFromSavingsArgs(BaseModel):
    pot_id: str = Field(..., min_length=1, max_length=36)
    amount: float = Field(..., gt=0, lt=1_000_000_000)
    note: Optional[str] = Field(None, max_length=50)
    date: Optional[str] = None
    currency: str | None = None

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return _validate_date_or_datetime(v)
