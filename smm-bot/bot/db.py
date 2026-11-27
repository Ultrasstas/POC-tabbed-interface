"""Database access. All prices are read from the database on the server;
nothing the customer sends is trusted for money."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import asyncpg

log = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

ACTIVE_STATUSES = ("awaiting_payment", "payment_review", "paid", "in_progress")


@dataclass
class CartLine:
    package_id: int
    post_url: str | None = None
    notes: str | None = None


class OrderError(Exception):
    """Raised when an order can't be created (e.g. a package was switched off)."""


class Database:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    @classmethod
    async def connect(cls, dsn: str) -> "Database":
        # statement_cache_size=0 keeps us compatible with Supabase's pooler.
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5, statement_cache_size=0)
        return cls(pool)

    async def close(self) -> None:
        await self.pool.close()

    # ---------- migrations ----------
    async def migrate(self) -> None:
        async with self.pool.acquire() as con:
            await con.execute("SELECT pg_advisory_lock(727001)")
            try:
                await con.execute(
                    "CREATE SCHEMA IF NOT EXISTS smm;"
                    "CREATE TABLE IF NOT EXISTS smm.schema_migrations ("
                    " name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"
                    "ALTER TABLE smm.schema_migrations ENABLE ROW LEVEL SECURITY;"
                )
                done = {r["name"] for r in await con.fetch("SELECT name FROM smm.schema_migrations")}
                for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
                    if path.name in done:
                        continue
                    log.info("Applying migration %s", path.name)
                    async with con.transaction():
                        await con.execute(path.read_text(encoding="utf-8"))
                        await con.execute("INSERT INTO smm.schema_migrations (name) VALUES ($1)", path.name)
            finally:
                await con.execute("SELECT pg_advisory_unlock(727001)")

    # ---------- catalog ----------
    async def services(self) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT s.* FROM smm.services s WHERE s.is_active AND EXISTS ("
            " SELECT 1 FROM smm.packages p WHERE p.service_code = s.code AND p.is_active)"
            " ORDER BY s.sort, s.code"
        )

    async def service(self, code: str) -> asyncpg.Record | None:
        return await self.pool.fetchrow("SELECT * FROM smm.services WHERE code = $1 AND is_active", code)

    async def packages(self, service_code: str) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT * FROM smm.packages WHERE service_code = $1 AND is_active ORDER BY quantity",
            service_code,
        )

    async def packages_by_ids(self, ids: list[int]) -> dict[int, asyncpg.Record]:
        rows = await self.pool.fetch(
            "SELECT p.id, p.quantity, p.price_cents, p.service_code, s.target, s.asks_notes,"
            " s.name_ru, s.name_uk, s.name_en, s.unit_ru, s.unit_uk, s.unit_en"
            " FROM smm.packages p JOIN smm.services s ON s.code = p.service_code"
            " WHERE p.id = ANY($1::int[]) AND p.is_active AND s.is_active",
            ids,
        )
        return {r["id"]: r for r in rows}

    # ---------- customers ----------
    async def upsert_customer(self, tg_id: int, first_name: str | None, tg_username: str | None) -> str | None:
        row = await self.pool.fetchrow(
            "INSERT INTO smm.customers (tg_id, first_name, tg_username) VALUES ($1, $2, $3)"
            " ON CONFLICT (tg_id) DO UPDATE SET first_name = EXCLUDED.first_name, tg_username = EXCLUDED.tg_username"
            " RETURNING lang",
            tg_id, first_name, tg_username,
        )
        return row["lang"]

    async def customer_lang(self, tg_id: int) -> str | None:
        return await self.pool.fetchval("SELECT lang FROM smm.customers WHERE tg_id = $1", tg_id)

    async def set_lang(self, tg_id: int, lang: str) -> None:
        await self.pool.execute("UPDATE smm.customers SET lang = $2 WHERE tg_id = $1", tg_id, lang)

    # ---------- settings ----------
    async def get_setting(self, key: str) -> str:
        return await self.pool.fetchval("SELECT value FROM smm.settings WHERE key = $1", key) or ""

    async def set_setting(self, key: str, value: str) -> None:
        await self.pool.execute(
            "INSERT INTO smm.settings (key, value) VALUES ($1, $2)"
            " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            key, value,
        )

    # ---------- orders ----------
    async def create_order(self, customer_id: int, ig_username: str, lines: list[CartLine]) -> int:
        if not lines:
            raise OrderError("empty cart")
        async with self.pool.acquire() as con, con.transaction():
            pkgs = {
                r["id"]: r
                for r in await con.fetch(
                    "SELECT p.id, p.quantity, p.price_cents, p.service_code, s.target"
                    " FROM smm.packages p JOIN smm.services s ON s.code = p.service_code"
                    " WHERE p.id = ANY($1::int[]) AND p.is_active AND s.is_active",
                    [ln.package_id for ln in lines],
                )
            }
            for ln in lines:
                pkg = pkgs.get(ln.package_id)
                if pkg is None:
                    raise OrderError(f"package {ln.package_id} is not available")
                if pkg["target"] == "post" and not ln.post_url:
                    raise OrderError(f"package {ln.package_id} needs a post link")
            total = sum(pkgs[ln.package_id]["price_cents"] for ln in lines)
            order_id = await con.fetchval(
                "INSERT INTO smm.orders (customer_id, ig_username, total_cents) VALUES ($1, $2, $3) RETURNING id",
                customer_id, ig_username, total,
            )
            await con.executemany(
                "INSERT INTO smm.order_items (order_id, package_id, service_code, quantity, price_cents, post_url, notes)"
                " VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [
                    (
                        order_id, ln.package_id, pkgs[ln.package_id]["service_code"],
                        pkgs[ln.package_id]["quantity"], pkgs[ln.package_id]["price_cents"],
                        ln.post_url if pkgs[ln.package_id]["target"] == "post" else None,
                        ln.notes or None,
                    )
                    for ln in lines
                ],
            )
            await con.execute(
                "INSERT INTO smm.order_events (order_id, actor_id, to_status) VALUES ($1, $2, 'awaiting_payment')",
                order_id, customer_id,
            )
            return order_id

    async def order(self, order_id: int) -> asyncpg.Record | None:
        return await self.pool.fetchrow(
            "SELECT o.*, c.first_name, c.tg_username, c.lang FROM smm.orders o"
            " JOIN smm.customers c ON c.tg_id = o.customer_id WHERE o.id = $1",
            order_id,
        )

    async def order_items(self, order_id: int) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT i.*, s.name_ru, s.name_uk, s.name_en, s.unit_ru, s.unit_uk, s.unit_en"
            " FROM smm.order_items i JOIN smm.services s ON s.code = i.service_code"
            " WHERE i.order_id = $1 ORDER BY i.id",
            order_id,
        )

    async def customer_orders(self, customer_id: int, limit: int = 10) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT * FROM smm.orders WHERE customer_id = $1 ORDER BY id DESC LIMIT $2", customer_id, limit
        )

    async def active_orders(self, limit: int = 30) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT * FROM smm.orders WHERE status = ANY($1::text[]) ORDER BY id LIMIT $2",
            list(ACTIVE_STATUSES), limit,
        )

    async def transition(
        self, order_id: int, allowed_from: tuple[str, ...], to_status: str,
        actor_id: int | None, note: str | None = None,
    ) -> asyncpg.Record | None:
        """Atomically move an order to a new status. Returns None if the order
        was not in an allowed status (e.g. someone already pressed the button)."""
        async with self.pool.acquire() as con, con.transaction():
            prev = await con.fetchval(
                "SELECT status FROM smm.orders WHERE id = $1 FOR UPDATE", order_id
            )
            if prev is None or prev not in allowed_from:
                return None
            row = await con.fetchrow(
                "UPDATE smm.orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
                order_id, to_status,
            )
            await con.execute(
                "INSERT INTO smm.order_events (order_id, actor_id, from_status, to_status, note)"
                " VALUES ($1, $2, $3, $4, $5)",
                order_id, actor_id, prev, to_status, note,
            )
            return row

    async def set_payment_method(self, order_id: int, customer_id: int, method: str) -> bool:
        res = await self.pool.execute(
            "UPDATE smm.orders SET payment_method = $3, updated_at = now()"
            " WHERE id = $1 AND customer_id = $2 AND status = 'awaiting_payment'",
            order_id, customer_id, method,
        )
        return res.endswith(" 1")

    async def set_crypto_invoice(self, order_id: int, invoice_id: int, pay_url: str) -> None:
        await self.pool.execute(
            "UPDATE smm.orders SET crypto_invoice_id = $2, crypto_pay_url = $3, updated_at = now() WHERE id = $1",
            order_id, invoice_id, pay_url,
        )

    async def set_team_message(self, order_id: int, message_id: int) -> None:
        await self.pool.execute("UPDATE smm.orders SET team_message_id = $2 WHERE id = $1", order_id, message_id)

    async def pending_crypto_orders(self) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT * FROM smm.orders WHERE status = 'awaiting_payment' AND payment_method = 'crypto'"
            " AND crypto_invoice_id IS NOT NULL AND created_at > now() - interval '2 days'"
        )
