"""Settings come only from environment variables (Railway Variables).
Nothing secret is ever stored in the repository."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    bot_token: str
    database_url: str
    team_chat_id: int
    admin_ids: frozenset[int]
    crypto_pay_token: str | None
    crypto_pay_testnet: bool


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is not set")
    return value


def _parse_ids(raw: str) -> frozenset[int]:
    ids = set()
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part:
            ids.add(int(part))
    return frozenset(ids)


def load_config() -> Config:
    admin_ids = _parse_ids(_required("ADMIN_IDS"))
    if not admin_ids:
        raise RuntimeError("ADMIN_IDS must contain at least one Telegram user ID")
    return Config(
        bot_token=_required("BOT_TOKEN"),
        database_url=_required("DATABASE_URL"),
        team_chat_id=int(_required("TEAM_CHAT_ID")),
        admin_ids=admin_ids,
        crypto_pay_token=os.environ.get("CRYPTO_PAY_TOKEN", "").strip() or None,
        crypto_pay_testnet=os.environ.get("CRYPTO_PAY_TESTNET", "").strip().lower() in ("1", "true", "yes"),
    )
