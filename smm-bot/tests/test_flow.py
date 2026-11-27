"""End-to-end flow through the real dispatcher with a fake Telegram API."""
import datetime as dt
import os
import re

import pytest
import pytest_asyncio
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.methods import CopyMessage, TelegramMethod
from aiogram.types import CallbackQuery, Chat, Message, MessageId, Update, User

from bot.config import Config
from bot.db import Database
from bot.handlers import client, team

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")

CUSTOMER, ADMIN, STRANGER, TEAM_CHAT = 111, 900, 555, -1001
BOT_ID = 42


class FakeSession(BaseSession):
    def __init__(self):
        super().__init__()
        self.calls: list[TelegramMethod] = []
        self._mid = 1000

    async def make_request(self, bot, method, timeout=None):
        self.calls.append(method)
        self._mid += 1
        ret = method.__returning__
        if ret is Message or getattr(ret, "__args__", None) and Message in ret.__args__:
            chat_id = getattr(method, "chat_id", None) or 0
            return Message(
                message_id=getattr(method, "message_id", None) or self._mid,
                date=dt.datetime.now(), chat=Chat(id=chat_id, type="private" if chat_id > 0 else "supergroup"),
                from_user=User(id=BOT_ID, is_bot=True, first_name="Bot"), text=getattr(method, "text", None),
            )
        if isinstance(method, CopyMessage):
            return MessageId(message_id=self._mid)
        return True

    async def close(self):
        pass

    async def stream_content(self, *a, **k):
        yield b""

    def texts(self, chat_id=None):
        return [c.text for c in self.calls if getattr(c, "text", None) and (chat_id is None or getattr(c, "chat_id", None) == chat_id)]

    def last_markup(self):
        for c in reversed(self.calls):
            if getattr(c, "reply_markup", None):
                return c.reply_markup
        return None


@pytest_asyncio.fixture
async def env():
    db = await Database.connect(DSN)
    await db.pool.execute("DROP SCHEMA IF EXISTS smm CASCADE")
    await db.migrate()
    await db.set_setting("card_details", "4441 1111 2222 3333")
    await db.set_setting("uah_rate", "41.5")
    session = FakeSession()
    bot = Bot("42:TEST", session=session, default=DefaultBotProperties(parse_mode="HTML"))
    cfg = Config("42:TEST", DSN, TEAM_CHAT, frozenset({ADMIN}), None, False)
    dp = Dispatcher(storage=MemoryStorage(), cfg=cfg, db=db, cryptopay=None)
    routers = (client.router, team.router, team.admin, team.support)
    dp.include_routers(*routers)
    yield dp, bot, session, db
    for r in routers:  # module-level routers: detach so the next test can attach them again
        r._parent_router = None
    await db.close()


_uid = 0


def _u(user_id):
    return User(id=user_id, is_bot=False, first_name=f"U{user_id}", username=f"u{user_id}")


async def send(dp, bot, user_id, text=None, chat_id=None, photo=False, reply_to=None):
    global _uid
    _uid += 1
    chat_id = chat_id or user_id
    kw = {}
    if photo:
        from aiogram.types import PhotoSize
        kw["photo"] = [PhotoSize(file_id="f", file_unique_id="u", width=1, height=1)]
    msg = Message(message_id=_uid, date=dt.datetime.now(),
                  chat=Chat(id=chat_id, type="private" if chat_id > 0 else "supergroup"),
                  from_user=_u(user_id), text=text, reply_to_message=reply_to, **kw)
    await dp.feed_update(bot, Update(update_id=_uid, message=msg))


async def press(dp, bot, user_id, data, chat_id=None):
    global _uid
    _uid += 1
    chat_id = chat_id or user_id
    msg = Message(message_id=_uid, date=dt.datetime.now(),
                  chat=Chat(id=chat_id, type="private" if chat_id > 0 else "supergroup"),
                  from_user=User(id=BOT_ID, is_bot=True, first_name="Bot"), text="x")
    cq = CallbackQuery(id=str(_uid), from_user=_u(user_id), chat_instance="c", data=data, message=msg)
    await dp.feed_update(bot, Update(update_id=_uid, callback_query=cq))


def buttons(markup):
    return {b.text: b.callback_data for row in markup.inline_keyboard for b in row}


def find(markup, pattern):
    for text, data in buttons(markup).items():
        if re.search(pattern, text):
            return data
    raise AssertionError(f"no button {pattern!r} in {list(buttons(markup))}")


async def test_full_card_flow(env):
    dp, bot, s, db = env
    await send(dp, bot, CUSTOMER, "/start")
    assert "Choose language" in s.texts()[-1]
    await press(dp, bot, CUSTOMER, "lang:uk")
    assert "Вітаємо" in s.texts()[-1]

    await press(dp, bot, CUSTOMER, "menu:new")
    await press(dp, bot, CUSTOMER, find(s.last_markup(), "Підписники$"))
    await press(dp, bot, CUSTOMER, find(s.last_markup(), r"^1,000 .*\$45\.00"))
    assert "$45.00" in s.texts()[-1]
    await press(dp, bot, CUSTOMER, "cart:add:0")
    await press(dp, bot, CUSTOMER, find(s.last_markup(), "^Коментарі"))
    await press(dp, bot, CUSTOMER, find(s.last_markup(), r"^10 .*\$42\.75"))
    assert "Разом: $87.75" in s.texts()[-1]

    await press(dp, bot, CUSTOMER, "cart:checkout:0")
    await send(dp, bot, CUSTOMER, "not a valid name!")
    assert "Не схоже" in s.texts()[-1]
    await send(dp, bot, CUSTOMER, "@My_Brand")
    assert "посилання на пост" in s.texts()[-1]
    await send(dp, bot, CUSTOMER, "https://evil.com/p/xyz12/")
    assert "Це не посилання" in s.texts()[-1]
    await send(dp, bot, CUSTOMER, "https://www.instagram.com/p/ABCDE12345/?igsh=1")
    assert "Побажання" in s.texts()[-1]
    await send(dp, bot, CUSTOMER, "англійською, про каву <b>")
    summary = s.texts()[-1]
    assert "@my_brand" in summary and "&lt;b&gt;" in summary and "$87.75" in summary

    await press(dp, bot, CUSTOMER, "flow:confirm")
    order_id = await db.pool.fetchval("SELECT max(id) FROM smm.orders")
    assert f"#{order_id}" in s.texts(CUSTOMER)[-1]
    assert any(f"Заказ #{order_id}" in x for x in s.texts(TEAM_CHAT))

    await press(dp, bot, CUSTOMER, f"pay:card:{order_id}")
    instr = s.texts(CUSTOMER)[-1]
    assert "4441 1111 2222 3333" in instr and "3 642" in instr  # 87.75 * 41.5 = 3641.6 -> 3642

    await send(dp, bot, CUSTOMER, "оплатив")
    assert "скріншот" in s.texts()[-1]
    await send(dp, bot, CUSTOMER, photo=True)
    assert (await db.order(order_id))["status"] == "payment_review"
    assert any(isinstance(c, CopyMessage) and c.chat_id == TEAM_CHAT for c in s.calls)

    # a stranger can't confirm payment
    await press(dp, bot, STRANGER, f"team:confirm_pay:{order_id}", chat_id=TEAM_CHAT)
    assert (await db.order(order_id))["status"] == "payment_review"

    for action, status in [("confirm_pay", "paid"), ("take", "in_progress"), ("done", "done")]:
        await press(dp, bot, ADMIN, f"team:{action}:{order_id}", chat_id=TEAM_CHAT)
        assert (await db.order(order_id))["status"] == status
    customer_msgs = "\n".join(s.texts(CUSTOMER))
    assert "Оплату замовлення" in customer_msgs and "виконано" in customer_msgs

    # pressing again is harmless
    await press(dp, bot, ADMIN, f"team:confirm_pay:{order_id}", chat_id=TEAM_CHAT)
    assert (await db.order(order_id))["status"] == "done"

    await send(dp, bot, CUSTOMER, "/orders")
    assert f"#{order_id}" in s.texts()[-1] and "виконано" in s.texts()[-1]


async def test_cannot_pay_someone_elses_order(env):
    dp, bot, s, db = env
    await send(dp, bot, CUSTOMER, "/start")
    await press(dp, bot, CUSTOMER, "lang:en")
    await press(dp, bot, CUSTOMER, "menu:new")
    await press(dp, bot, CUSTOMER, find(s.last_markup(), "^Followers$"))
    await press(dp, bot, CUSTOMER, find(s.last_markup(), r"^100 "))
    await press(dp, bot, CUSTOMER, "cart:checkout:0")
    await send(dp, bot, CUSTOMER, "brand")
    await press(dp, bot, CUSTOMER, "flow:confirm")
    oid = await db.pool.fetchval("SELECT max(id) FROM smm.orders")
    n = len(s.calls)
    await send(dp, bot, STRANGER, "/start")
    await press(dp, bot, STRANGER, f"pay:card:{oid}")
    assert (await db.order(oid))["payment_method"] is None
    assert not any("4441" in (getattr(c, "text", "") or "") for c in s.calls[n:])


async def test_support_relay(env):
    dp, bot, s, db = env
    await send(dp, bot, CUSTOMER, "/start")
    await press(dp, bot, CUSTOMER, "lang:ru")
    await send(dp, bot, CUSTOMER, "Здравствуйте, вопрос по заказу")
    relayed = s.texts(TEAM_CHAT)[-1]
    assert f"#client{CUSTOMER}" in relayed
    orig = Message(message_id=5, date=dt.datetime.now(), chat=Chat(id=TEAM_CHAT, type="supergroup"),
                   from_user=User(id=BOT_ID, is_bot=True, first_name="Bot"), text=relayed)
    await send(dp, bot, ADMIN, "Добрый день! Всё в работе", chat_id=TEAM_CHAT, reply_to=orig)
    assert "Всё в работе" in s.texts(CUSTOMER)[-1]


async def test_admin_commands(env):
    dp, bot, s, db = env
    await send(dp, bot, STRANGER, "/setcard 1234")
    assert await db.get_setting("card_details") == "4441 1111 2222 3333"
    await send(dp, bot, ADMIN, "/setcard 5375 0000 0000 1111 Mono")
    assert await db.get_setting("card_details") == "5375 0000 0000 1111 Mono"
    await send(dp, bot, ADMIN, "/setrate 40")
    assert await db.get_setting("uah_rate") == "40"
