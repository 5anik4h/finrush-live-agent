"""Shared financial calculation utilities."""
import datetime
import math

FREQUENCY_PERIODS: dict[str, int] = {
    "daily": 365,
    "weekly": 52,
    "monthly": 12,
    "quarterly": 4,
    "annual": 1,
}


def calc_compound_interest(
    principal: float,
    apy: float,
    frequency: str,
    start_date_str: str,
) -> float:
    """Calculate accrued compound interest from start_date to now (UTC).

    Returns the total accumulated interest (not the total amount).
    If reinvest=True, the caller should interpret total = principal + interest.

    Args:
        principal: Invested capital in the asset's currency.
        apy: Annual percentage yield as a percentage (e.g. 3.5 for 3.5%).
        frequency: Compounding frequency key — one of FREQUENCY_PERIODS.
        start_date_str: ISO date string "YYYY-MM-DD" when the product started.

    Returns:
        Accrued interest rounded to 6 decimal places, or 0.0 on invalid input.
    """
    try:
        start = datetime.date.fromisoformat(start_date_str)
    except (ValueError, TypeError):
        return 0.0

    now = datetime.datetime.now(datetime.timezone.utc).date()
    t = (now - start).days / 365.25  # years elapsed
    if t <= 0 or principal <= 0 or apy <= 0:
        return 0.0

    n = FREQUENCY_PERIODS.get(frequency, 12)
    r = apy / 100.0
    total = principal * math.pow(1 + r / n, n * t)
    return round(total - principal, 6)
