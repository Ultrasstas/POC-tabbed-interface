"""Keeps the team's order card and the customer in sync with order status."""
from __future__ import annotations

import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from .config import Config
from .db import Database
from .texts import t
from .ui import team_kb, team_order_text

log = logging.getLogger(__name__)

CUSTOMER_NOTICE = {
    "paid": "notify_paid",
    "in_progress": "notify_in_progress",
    "done": "notify_done",
    "rejected": "notify_rejected",
    "cancelled": "notify_cancelled",
}


async def post_team_card(bot: Bot, cfg: Config, db: Database, order_id: int) -> None:
    if not cfg.team_chat_id:
        log.warning("TEAM_CHAT_ID is not set: order %s was not posted to the team", order_id)
        return
    order = await db.order(order_id)
    items = await db.order_items(order_id)
    try:
        msg = await bot.send_message(
            cfg.team_chat_id, "🆕 " + team_order_text(order, items),
            reply_markup=team_kb(order), disable_web_page_preview=True,
        )
        await db.set_team_message(order_id, msg.message_id)
    except TelegramAPIError:
        log.exception("Could not post order %s to the team chat", order_id)


async def refresh_team_card(bot: Bot, cfg: Config, db: Database, order_id: int, last_action: str | None = None) -> None:
    order = await db.order(order_id)
    if order is None:
        return
    items = await db.order_items(order_id)
    text = team_order_text(order, items, last_action)
    if order["team_message_id"] and cfg.team_chat_id:
        try:
            await bot.edit_message_text(
                text, chat_id=cfg.team_chat_id, message_id=order["team_message_id"],
                reply_markup=team_kb(order), disable_web_page_preview=True,
            )
            return
        except TelegramAPIError as e:
            if "message is not modified" in str(e):
                return
            log.warning("Could not edit team card for order %s: %s", order_id, e)
    await post_team_card(bot, cfg, db, order_id)


async def notify_customer(bot: Bot, db: Database, order_id: int) -> None:
    order = await db.order(order_id)
    key = CUSTOMER_NOTICE.get(order["status"]) if order else None
    if not key:
        return
    try:
        await bot.send_message(order["customer_id"], t(key, order["lang"], id=order_id))
    except TelegramAPIError:
        log.warning("Could not notify customer of order %s", order_id)
