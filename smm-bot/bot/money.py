from __future__ import annotations

from decimal import ROUND_CEILING, Decimal, InvalidOperation


def fmt_usd(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def parse_rate(raw: str | None) -> Decimal | None:
    try:
        rate = Decimal((raw or "").replace(",", ".").strip())
    except InvalidOperation:
        return None
    return rate if rate > 0 else None


def usd_to_uah(cents: int, rate: Decimal) -> int:
    """Whole hryvnias, rounded up so the customer never underpays."""
    return int((Decimal(cents) / 100 * rate).to_integral_value(rounding=ROUND_CEILING))
