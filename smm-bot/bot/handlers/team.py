"""Team side: order buttons in the team chat, admin commands, support relay."""
from __future__ import annotations

import logging
import re
from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, Message

from ..config import Config
from ..db import ACTIVE_STATUSES, Database
from ..money import fmt_usd, parse_rate
from ..notify import notify_customer, refresh_team_card
from ..ui import TEAM_STATUS, TeamCb

log = logging.getLogger(__name__)
router = Router(name="team")

# action -> (allowed current statuses, new status, label for the log line)
TRANSITIONS: dict[str, tuple[tuple[str, ...], str, str]] = {
    "confirm_pay": (("awaiting_payment", "payment_review"), "paid", "подтвердил(а) оплату"),
    "reject_pay": (("awaiting_payment", "payment_review"), "rejected", "отклонил(а) оплату"),
    "take": (("paid",), "in_progress", "взял(а) в работу"),
    "done": (("paid", "in_progress"), "done", "отметил(а) выполненным"),
    "cancel": (ACTIVE_STATUSES, "cancelled", "отменил(а) заказ"),
}
SUPPORT_TAG = re.compile(r"#client(\d+)")


def is_admin(cfg: Config, user_id: int) -> bool:
    return user_id in cfg.admin_ids


# ---------- order buttons ----------
@router.callback_query(TeamCb.filter())
async def on_team_action(cb: CallbackQuery, callback_data: TeamCb, bot: Bot, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, cb.from_user.id):
        await cb.answer("⛔ Нет доступа", show_alert=True)
        log.warning("Non-admin %s pressed %s on order %s", cb.from_user.id, callback_data.action, callback_data.order_id)
        return
    rule = TRANSITIONS.get(callback_data.action)
    if rule is None:
        await cb.answer()
        return
    allowed, new_status, label = rule
    who = cb.from_user.first_name or str(cb.from_user.id)
    row = await db.transition(callback_data.order_id, allowed, new_status, cb.from_user.id, label)
    if row is None:
        await cb.answer("Статус уже изменён кем-то другим, обновляю карточку", show_alert=True)
        await refresh_team_card(bot, cfg, db, callback_data.order_id)
        return
    await refresh_team_card(bot, cfg, db, callback_data.order_id, f"{who} {label}")
    await notify_customer(bot, db, callback_data.order_id)
    await cb.answer("Готово")


# ---------- utility ----------
@router.message(Command("id"))
async def cmd_id(message: Message) -> None:
    await message.answer(
        f"Ваш Telegram ID: <code>{message.from_user.id}</code>\nID этого чата: <code>{message.chat.id}</code>"
    )


# ---------- admin commands (private chat only) ----------
admin = Router(name="admin")
admin.message.filter(F.chat.type == "private")


@admin.message(Command("setcard"))
async def cmd_setcard(message: Message, command: CommandObject, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, message.from_user.id):
        return
    if not command.args:
        await message.answer("Использование: <code>/setcard 4441 1111 2222 3333, Monobank, Иван И.</code>")
        return
    await db.set_setting("card_details", command.args.strip()[:300])
    await message.answer("✅ Реквизиты карты обновлены. Сообщение с ними лучше удалить из чата.")


@admin.message(Command("setrate"))
async def cmd_setrate(message: Message, command: CommandObject, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, message.from_user.id):
        return
    raw = (command.args or "").strip()
    if raw in ("0", "off", "-"):
        await db.set_setting("uah_rate", "")
        await message.answer("✅ Курс выключен: клиенты видят сумму только в $.")
        return
    rate = parse_rate(raw)
    if rate is None:
        await message.answer("Использование: <code>/setrate 42.5</code> (гривен за $1), или <code>/setrate off</code>")
        return
    await db.set_setting("uah_rate", str(rate))
    await message.answer(f"✅ Курс: 1 $ = {rate} ₴. Сумма к переводу округляется вверх до гривны.")


@admin.message(Command("setsupport"))
async def cmd_setsupport(message: Message, command: CommandObject, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, message.from_user.id):
        return
    await db.set_setting("support_contact", (command.args or "").strip()[:200])
    await message.answer("✅ Контакт поддержки обновлён." if command.args else "✅ Контакт убран: вопросы клиентов будут приходить в группу команды.")


@admin.message(Command("settings"))
async def cmd_settings(message: Message, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, message.from_user.id):
        return
    card = await db.get_setting("card_details")
    masked = card[:4] + " **** " + card[-4:] if len(card) > 12 else card
    await message.answer(
        "⚙️ <b>Настройки</b>\n"
        f"Карта: <code>{escape(masked)}</code>\n"
        f"Курс ₴: {escape(await db.get_setting('uah_rate') or 'выключен')}\n"
        f"Поддержка: {escape(await db.get_setting('support_contact') or 'вопросы идут в группу')}\n\n"
        "Команды: /setcard, /setrate, /setsupport, /active"
    )


@admin.message(Command("active"))
async def cmd_active(message: Message, cfg: Config, db: Database) -> None:
    if not is_admin(cfg, message.from_user.id):
        return
    orders = await db.active_orders()
    if not orders:
        await message.answer("Активных заказов нет 🎉")
        return
    lines = ["<b>Активные заказы</b>"]
    for o in orders:
        lines.append(f"#{o['id']} · @{escape(o['ig_username'])} · {fmt_usd(o['total_cents'])} · {TEAM_STATUS[o['status']]}")
    await message.answer("\n".join(lines))


# ---------- support relay ----------
support = Router(name="support")


@support.message(F.chat.type == "private", F.text & ~F.text.startswith("/"))
async def customer_message(message: Message, bot: Bot, cfg: Config) -> None:
    """Free text from a customer outside the order flow goes to the team chat."""
    if not cfg.team_chat_id:
        await message.answer("/start")
        return
    u = message.from_user
    who = escape(u.first_name or "")
    if u.username:
        who += f" (@{escape(u.username)})"
    await bot.send_message(
        cfg.team_chat_id,
        f"💬 Сообщение от клиента {who} #client{u.id}\n\n{escape(message.text[:3000])}\n\n"
        "<i>Ответьте на это сообщение (Reply), и бот перешлёт ответ клиенту.</i>",
    )
    await message.answer("✉️ Передали менеджеру, скоро ответим.\n✉️ Передали менеджеру, скоро відповімо.\n✉️ Sent to a manager.")


@support.message(F.chat.func(lambda chat: True), F.reply_to_message, F.text)
async def team_reply(message: Message, bot: Bot, cfg: Config) -> None:
    """A team member replies to a relayed customer message → send it to the customer."""
    if message.chat.id != cfg.team_chat_id or not is_admin(cfg, message.from_user.id):
        return
    original = message.reply_to_message
    if original.from_user is None or original.from_user.id != bot.id:
        return
    m = SUPPORT_TAG.search(original.text or "")
    if not m:
        return
    try:
        await bot.send_message(int(m.group(1)), f"💬 {escape(message.text[:3000])}")
        await message.reply("✅ Отправлено клиенту")
    except Exception as e:
        await message.reply(f"Не удалось отправить: {escape(str(e))}")


@support.message(F.chat.type == "private")
async def fallback(message: Message) -> None:
    await message.answer("/start")
