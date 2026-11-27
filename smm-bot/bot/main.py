"""Entry point: python -m bot"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque

from aiogram import BaseMiddleware, Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, Message, TelegramObject

from .config import load_config
from .cryptopay import CryptoPay
from .db import Database
from .handlers import client, team
from .notify import notify_customer, refresh_team_card
from .texts import t

log = logging.getLogger("bot")


class Throttle(BaseMiddleware):
    """Drops messages from a user who sends more than `limit` in `window` seconds."""

    def __init__(self, limit: int = 12, window: float = 10.0):
        self.limit, self.window = limit, window
        self.hits: dict[int, deque[float]] = defaultdict(deque)

    async def __call__(self, handler, event: TelegramObject, data: dict):
        user = data.get("event_from_user")
        if user is None:
            return await handler(event, data)
        now = time.monotonic()
        q = self.hits[user.id]
        while q and now - q[0] > self.window:
            q.popleft()
        q.append(now)
        if len(q) > self.limit:
            if len(q) == self.limit + 1 and isinstance(event, Message):
                await event.answer(t("too_fast", None))
            return None
        return await handler(event, data)


async def crypto_watcher(bot: Bot, cfg, db: Database, cryptopay: CryptoPay, every: float = 20.0) -> None:
    """Polls Crypto Pay for unpaid invoices. No public webhook is needed."""
    while True:
        try:
            orders = await db.pending_crypto_orders()
            if orders:
                by_invoice = {o["crypto_invoice_id"]: o["id"] for o in orders}
                for inv in await cryptopay.get_invoices(list(by_invoice)):
                    if inv.get("status") != "paid":
                        continue
                    oid = by_invoice.get(inv.get("invoice_id"))
                    if oid is None or str(inv.get("payload")) != str(oid):
                        continue
                    note = f"crypto {inv.get('paid_amount')} {inv.get('paid_asset')}"
                    if await db.transition(oid, ("awaiting_payment",), "paid", None, note):
                        log.info("Order %s paid via crypto", oid)
                        await refresh_team_card(bot, cfg, db, oid, f"Оплачено криптой: {inv.get('paid_amount')} {inv.get('paid_asset')}")
                        await notify_customer(bot, db, oid)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Crypto watcher iteration failed")
        await asyncio.sleep(every)


async def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("aiogram.event").setLevel(logging.WARNING)  # don't log message contents
    cfg = load_config()
    db = await Database.connect(cfg.database_url)
    await db.migrate()

    bot = Bot(cfg.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    cryptopay = CryptoPay(cfg.crypto_pay_token, cfg.crypto_pay_testnet) if cfg.crypto_pay_token else None

    dp = Dispatcher(storage=MemoryStorage(), cfg=cfg, db=db, cryptopay=cryptopay)
    dp.message.outer_middleware(Throttle())
    dp.callback_query.outer_middleware(Throttle(limit=20))
    dp.include_routers(client.router, team.router, team.admin, team.support)

    await bot.set_my_commands([
        BotCommand(command="start", description="Menu / Меню"),
        BotCommand(command="orders", description="My orders / Мои заказы"),
        BotCommand(command="support", description="Support / Поддержка"),
        BotCommand(command="language", description="Language / Язык"),
    ])

    watcher = asyncio.create_task(crypto_watcher(bot, cfg, db, cryptopay)) if cryptopay else None
    log.info("Bot started (crypto payments: %s)", "on" if cryptopay else "off")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        if watcher:
            watcher.cancel()
        if cryptopay:
            await cryptopay.close()
        await db.close()
        await bot.session.close()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
