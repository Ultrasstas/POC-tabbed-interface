"""Integration tests against a real Postgres. Set TEST_DATABASE_URL to run."""
import asyncio
import os

import pytest
import pytest_asyncio

from bot.db import CartLine, Database, OrderError

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")


@pytest_asyncio.fixture
async def db():
    d = await Database.connect(DSN)
    await d.pool.execute("DROP SCHEMA IF EXISTS smm CASCADE")
    await d.migrate()
    await d.migrate()  # idempotent
    await d.upsert_customer(111, "Test", "tester")
    yield d
    await d.close()


async def pkg(db, code, qty):
    return await db.pool.fetchval(
        "SELECT id FROM smm.packages WHERE service_code=$1 AND quantity=$2", code, qty)


async def test_catalog_prices(db):
    services = await db.services()
    assert [s["code"] for s in services] == [
        "followers", "premium_followers", "post_likes", "video_views", "comments", "bulk_likes", "auto_likes"]
    prices = {p["quantity"]: p["price_cents"] for p in await db.packages("followers")}
    assert prices[1000] == 4500 and prices[5000] == 18000 and prices[100] == 534
    comments = {p["quantity"]: p["price_cents"] for p in await db.packages("comments")}
    assert comments[10] == 4275


async def test_order_total_is_computed_server_side(db):
    f1000 = await pkg(db, "followers", 1000)
    l500 = await pkg(db, "post_likes", 500)
    oid = await db.create_order(111, "brand", [
        CartLine(f1000), CartLine(l500, post_url="https://www.instagram.com/p/ABCDE/")])
    order = await db.order(oid)
    assert order["total_cents"] == 4500 + 765
    assert order["status"] == "awaiting_payment"
    items = await db.order_items(oid)
    assert items[0]["post_url"] is None and items[1]["post_url"].endswith("/ABCDE/")


async def test_post_service_requires_link(db):
    l500 = await pkg(db, "post_likes", 500)
    with pytest.raises(OrderError):
        await db.create_order(111, "brand", [CartLine(l500)])


async def test_disabled_package_rejected(db):
    f100 = await pkg(db, "followers", 100)
    await db.pool.execute("UPDATE smm.packages SET is_active=false WHERE id=$1", f100)
    with pytest.raises(OrderError):
        await db.create_order(111, "brand", [CartLine(f100)])
    assert 100 not in {p["quantity"] for p in await db.packages("followers")}


async def test_price_change_does_not_touch_existing_orders(db):
    f1000 = await pkg(db, "followers", 1000)
    oid = await db.create_order(111, "brand", [CartLine(f1000)])
    await db.pool.execute("UPDATE smm.packages SET price_cents=9999 WHERE id=$1", f1000)
    assert (await db.order(oid))["total_cents"] == 4500


async def test_double_confirm_only_once(db):
    f1000 = await pkg(db, "followers", 1000)
    oid = await db.create_order(111, "brand", [CartLine(f1000)])
    results = await asyncio.gather(*[
        db.transition(oid, ("awaiting_payment", "payment_review"), "paid", 999) for _ in range(5)])
    assert sum(r is not None for r in results) == 1
    assert await db.transition(oid, ("paid",), "in_progress", 999) is not None
    assert await db.transition(oid, ("awaiting_payment",), "paid", 999) is None
    events = await db.pool.fetch("SELECT to_status FROM smm.order_events WHERE order_id=$1 ORDER BY id", oid)
    assert [e["to_status"] for e in events] == ["awaiting_payment", "paid", "in_progress"]


async def test_payment_method_only_for_owner(db):
    await db.upsert_customer(222, "Other", None)
    f1000 = await pkg(db, "followers", 1000)
    oid = await db.create_order(111, "brand", [CartLine(f1000)])
    assert not await db.set_payment_method(oid, 222, "card")
    assert await db.set_payment_method(oid, 111, "card")


async def test_settings(db):
    assert await db.get_setting("uah_rate") == ""
    await db.set_setting("uah_rate", "41.5")
    assert await db.get_setting("uah_rate") == "41.5"
