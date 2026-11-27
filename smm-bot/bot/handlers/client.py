"""Customer flow: language → services → packages → cart → username → links → confirm → pay."""
from __future__ import annotations

import logging
from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message, ReplyParameters

from ..config import Config
from ..cryptopay import CryptoPay, CryptoPayError
from ..db import CartLine, Database, OrderError
from ..money import fmt_usd, parse_rate, usd_to_uah
from ..notify import post_team_card, refresh_team_card
from ..texts import DEFAULT_LANG, LANGS, t
from ..ui import (
    CartCb, FlowCb, LangCb, MenuCb, PayCb, PkgCb, SvcCb, cart_kb, cart_text, confirm_kb, home_kb,
    lang_kb, menu_kb, packages_kb, payment_kb, services_kb, skip_kb, summary_text, url_kb,
)
from ..validators import clean_notes, normalize_post_url, normalize_username

log = logging.getLogger(__name__)
router = Router(name="client")
router.message.filter(F.chat.type == "private")
router.callback_query.filter(F.message.chat.type == "private")

MAX_CART = 10


class Flow(StatesGroup):
    username = State()
    link = State()
    notes = State()
    proof = State()


# ---------- helpers ----------
async def get_lang(state: FSMContext, db: Database, user_id: int) -> str:
    data = await state.get_data()
    lang = data.get("lang")
    if lang not in LANGS:
        lang = await db.customer_lang(user_id) or DEFAULT_LANG
        await state.update_data(lang=lang)
    return lang


async def reset_flow(state: FSMContext, lang: str) -> None:
    await state.clear()
    await state.update_data(lang=lang, cart=[])


async def cart_rows(db: Database, cart: list[dict]):
    """Rows for the cart, in cart order. Drops items whose package disappeared."""
    pkgs = await db.packages_by_ids([c["pkg"] for c in cart])
    kept = [c for c in cart if c["pkg"] in pkgs]
    return kept, [pkgs[c["pkg"]] for c in kept]


async def show_menu(target: Message, lang: str, edit: bool = False) -> None:
    if edit:
        await target.edit_text(t("menu", lang), reply_markup=menu_kb(lang))
    else:
        await target.answer(t("menu", lang), reply_markup=menu_kb(lang))


async def show_cart(message: Message, state: FSMContext, db: Database, lang: str, edit: bool) -> None:
    data = await state.get_data()
    cart, rows = await cart_rows(db, data.get("cart", []))
    await state.update_data(cart=cart)
    if not rows:
        services = await db.services()
        send = message.edit_text if edit else message.answer
        await send(t("choose_service", lang), reply_markup=services_kb(services, lang, has_cart=False))
        return
    send = message.edit_text if edit else message.answer
    await send(cart_text(rows, lang), reply_markup=cart_kb(rows, lang))


async def next_step(message: Message, state: FSMContext, db: Database, lang: str) -> None:
    """After the username: ask a link for every post-based item, then notes for
    comments, then show the summary."""
    data = await state.get_data()
    cart, rows = await cart_rows(db, data.get("cart", []))
    await state.update_data(cart=cart)
    if not rows:
        await reset_flow(state, lang)
        await message.answer(t("session_expired", lang))
        return
    for i, (item, row) in enumerate(zip(cart, rows)):
        label = escape(f"{row['name_' + lang]}: {row['quantity']:,} {row['unit_' + lang]}")
        if row["target"] == "post" and not item.get("url"):
            await state.update_data(idx=i)
            await state.set_state(Flow.link)
            await message.answer(t("ask_link", lang, item=label), disable_web_page_preview=True)
            return
        if row["asks_notes"] and not item.get("notes_asked"):
            await state.update_data(idx=i)
            await state.set_state(Flow.notes)
            await message.answer(t("ask_notes", lang, item=label), reply_markup=skip_kb(lang))
            return
    await state.set_state(None)
    await message.answer(
        summary_text(data["username"], rows, cart, lang),
        reply_markup=confirm_kb(lang), disable_web_page_preview=True,
    )


# ---------- start / menu ----------
@router.message(CommandStart())
@router.message(Command("menu"))
async def cmd_start(message: Message, state: FSMContext, db: Database) -> None:
    u = message.from_user
    lang = await db.upsert_customer(u.id, u.first_name, u.username)
    if lang not in LANGS:
        await state.clear()
        await message.answer(t("choose_lang", None), reply_markup=lang_kb())
        return
    await reset_flow(state, lang)
    await show_menu(message, lang)


@router.message(Command("language"))
async def cmd_language(message: Message) -> None:
    await message.answer(t("choose_lang", None), reply_markup=lang_kb())


@router.callback_query(LangCb.filter())
async def on_lang(cb: CallbackQuery, callback_data: LangCb, state: FSMContext, db: Database) -> None:
    lang = callback_data.code if callback_data.code in LANGS else DEFAULT_LANG
    u = cb.from_user
    await db.upsert_customer(u.id, u.first_name, u.username)
    await db.set_lang(u.id, lang)
    await reset_flow(state, lang)
    await show_menu(cb.message, lang, edit=True)
    await cb.answer()


@router.callback_query(MenuCb.filter())
async def on_menu(cb: CallbackQuery, callback_data: MenuCb, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    action = callback_data.action
    if action == "home":
        await reset_flow(state, lang)
        await show_menu(cb.message, lang, edit=True)
    elif action == "new":
        await state.set_state(None)
        data = await state.get_data()
        services = await db.services()
        await cb.message.edit_text(
            t("choose_service", lang), reply_markup=services_kb(services, lang, has_cart=bool(data.get("cart")))
        )
    elif action == "orders":
        await show_my_orders(cb.message, db, cb.from_user.id, lang)
    elif action == "support":
        await show_support(cb.message, db, lang)
    elif action == "lang":
        await cb.message.edit_text(t("choose_lang", None), reply_markup=lang_kb())
    await cb.answer()


@router.message(Command("orders"))
async def cmd_orders(message: Message, state: FSMContext, db: Database) -> None:
    await show_my_orders(message, db, message.from_user.id, await get_lang(state, db, message.from_user.id))


@router.message(Command("support"))
async def cmd_support(message: Message, state: FSMContext, db: Database) -> None:
    await show_support(message, db, await get_lang(state, db, message.from_user.id))


async def show_my_orders(message: Message, db: Database, user_id: int, lang: str) -> None:
    orders = await db.customer_orders(user_id)
    if not orders:
        await message.answer(t("my_orders_empty", lang), reply_markup=home_kb(lang))
        return
    rows = [t("my_orders_title", lang), ""]
    for o in orders:
        rows.append(f"#{o['id']} · {o['created_at']:%d.%m.%Y} · {fmt_usd(o['total_cents'])} · {t('st_' + o['status'], lang)}")
    await message.answer("\n".join(rows), reply_markup=home_kb(lang))


async def show_support(message: Message, db: Database, lang: str) -> None:
    contact = (await db.get_setting("support_contact")).strip()
    text = t("support", lang, contact=escape(contact)) if contact else t("support_none", lang)
    await message.answer(text, reply_markup=home_kb(lang))


# ---------- catalog & cart ----------
@router.callback_query(SvcCb.filter())
async def on_service(cb: CallbackQuery, callback_data: SvcCb, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    service = await db.service(callback_data.code)
    packages = await db.packages(callback_data.code) if service else []
    if not packages:
        await cb.answer(t("order_unavailable", lang), show_alert=True)
        return
    await cb.message.edit_text(
        t("choose_package", lang, service=escape(service["name_" + lang])),
        reply_markup=packages_kb(service, packages, lang),
    )
    await cb.answer()


@router.callback_query(PkgCb.filter())
async def on_package(cb: CallbackQuery, callback_data: PkgCb, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    if callback_data.id not in await db.packages_by_ids([callback_data.id]):
        await cb.answer(t("order_unavailable", lang), show_alert=True)
        return
    data = await state.get_data()
    cart = data.get("cart", [])
    if len(cart) >= MAX_CART:
        await cb.answer(t("cart_full", lang, n=MAX_CART), show_alert=True)
    else:
        cart.append({"pkg": callback_data.id})
        await state.update_data(cart=cart)
        await cb.answer("✅")
    await state.set_state(None)
    await show_cart(cb.message, state, db, lang, edit=True)


@router.callback_query(CartCb.filter())
async def on_cart(cb: CallbackQuery, callback_data: CartCb, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    data = await state.get_data()
    cart = data.get("cart", [])
    action = callback_data.action
    if action == "add":
        services = await db.services()
        await cb.message.edit_text(t("choose_service", lang), reply_markup=services_kb(services, lang, has_cart=True))
    elif action == "show":
        await show_cart(cb.message, state, db, lang, edit=True)
    elif action == "rm":
        if 0 <= callback_data.idx < len(cart):
            cart.pop(callback_data.idx)
            await state.update_data(cart=cart)
        await show_cart(cb.message, state, db, lang, edit=True)
    elif action == "cancel":
        await reset_flow(state, lang)
        await show_menu(cb.message, lang, edit=True)
    elif action == "checkout":
        if not cart:
            await cb.answer(t("cart_empty", lang), show_alert=True)
            return
        # Fresh start for per-item details in case the customer went back.
        await state.update_data(cart=[{"pkg": c["pkg"]} for c in cart])
        await state.set_state(Flow.username)
        await cb.message.edit_reply_markup(reply_markup=None)
        await cb.message.answer(t("ask_username", lang))
    await cb.answer()


# ---------- details ----------
@router.message(Flow.username, F.text)
async def on_username(message: Message, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, message.from_user.id)
    username = normalize_username(message.text)
    if not username:
        await message.answer(t("bad_username", lang))
        return
    await state.update_data(username=username)
    await next_step(message, state, db, lang)


@router.message(Flow.link, F.text)
async def on_link(message: Message, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, message.from_user.id)
    url = normalize_post_url(message.text)
    if not url:
        await message.answer(t("bad_link", lang))
        return
    data = await state.get_data()
    cart, idx = data.get("cart", []), data.get("idx", -1)
    if not 0 <= idx < len(cart):
        await reset_flow(state, lang)
        await message.answer(t("session_expired", lang))
        return
    cart[idx]["url"] = url
    await state.update_data(cart=cart)
    await next_step(message, state, db, lang)


async def _save_notes(state: FSMContext, notes: str) -> bool:
    data = await state.get_data()
    cart, idx = data.get("cart", []), data.get("idx", -1)
    if not 0 <= idx < len(cart):
        return False
    cart[idx]["notes"] = notes
    cart[idx]["notes_asked"] = True
    await state.update_data(cart=cart)
    return True


@router.message(Flow.notes, F.text)
async def on_notes(message: Message, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, message.from_user.id)
    if not await _save_notes(state, clean_notes(message.text)):
        await reset_flow(state, lang)
        await message.answer(t("session_expired", lang))
        return
    await next_step(message, state, db, lang)


@router.callback_query(FlowCb.filter(F.action == "skip_notes"), Flow.notes)
async def on_skip_notes(cb: CallbackQuery, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    await cb.message.edit_reply_markup(reply_markup=None)
    if not await _save_notes(state, ""):
        await reset_flow(state, lang)
        await cb.message.answer(t("session_expired", lang))
    else:
        await next_step(cb.message, state, db, lang)
    await cb.answer()


@router.message(StateFilter(Flow.username, Flow.link, Flow.notes))
async def on_wrong_input(message: Message, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, message.from_user.id)
    current = await state.get_state()
    key = {Flow.username.state: "bad_username", Flow.link.state: "bad_link"}.get(current, "unknown")
    await message.answer(t(key, lang))


# ---------- confirm & pay ----------
@router.callback_query(FlowCb.filter(F.action == "cancel"))
async def on_cancel(cb: CallbackQuery, state: FSMContext, db: Database) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    await reset_flow(state, lang)
    await cb.message.edit_text(t("cancelled", lang), reply_markup=home_kb(lang))
    await cb.answer()


@router.callback_query(FlowCb.filter(F.action == "confirm"))
async def on_confirm(cb: CallbackQuery, state: FSMContext, db: Database, bot: Bot, cfg: Config,
                     cryptopay: CryptoPay | None) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    data = await state.get_data()
    cart, username = data.get("cart", []), data.get("username")
    if not cart or not username:
        await cb.answer(t("session_expired", lang), show_alert=True)
        return
    lines = [CartLine(package_id=c["pkg"], post_url=c.get("url"), notes=c.get("notes")) for c in cart]
    try:
        order_id = await db.create_order(cb.from_user.id, username, lines)
    except OrderError as e:
        log.info("Order rejected for %s: %s", cb.from_user.id, e)
        await reset_flow(state, lang)
        await cb.message.edit_text(t("order_unavailable", lang), reply_markup=home_kb(lang))
        await cb.answer()
        return
    await reset_flow(state, lang)
    order = await db.order(order_id)
    await cb.message.edit_reply_markup(reply_markup=None)
    await cb.message.answer(
        t("choose_payment", lang, id=order_id, total=fmt_usd(order["total_cents"])),
        reply_markup=payment_kb(order_id, lang, crypto_enabled=cryptopay is not None),
    )
    await post_team_card(bot, cfg, db, order_id)
    await cb.answer()


@router.callback_query(PayCb.filter())
async def on_pay(cb: CallbackQuery, callback_data: PayCb, state: FSMContext, db: Database, bot: Bot,
                 cfg: Config, cryptopay: CryptoPay | None) -> None:
    lang = await get_lang(state, db, cb.from_user.id)
    order = await db.order(callback_data.order_id)
    if order is None or order["customer_id"] != cb.from_user.id or order["status"] != "awaiting_payment":
        await cb.answer(t("order_not_payable", lang), show_alert=True)
        return
    oid = order["id"]

    if callback_data.method == "crypto":
        if cryptopay is None:
            await cb.answer(t("crypto_unavailable", lang), show_alert=True)
            return
        pay_url = order["crypto_pay_url"]
        if not pay_url:
            try:
                inv = await cryptopay.create_invoice(oid, order["total_cents"], f"Order #{oid}")
            except (CryptoPayError, OSError) as e:
                log.warning("Crypto invoice failed for order %s: %s", oid, e)
                await cb.answer(t("crypto_unavailable", lang), show_alert=True)
                return
            pay_url = inv.get("bot_invoice_url") or inv.get("pay_url")
            await db.set_crypto_invoice(oid, inv["invoice_id"], pay_url)
        await db.set_payment_method(oid, cb.from_user.id, "crypto")
        await state.set_state(None)
        await cb.message.answer(
            t("crypto_invoice", lang, amount=fmt_usd(order["total_cents"])),
            reply_markup=url_kb(t("btn_open_invoice", lang), pay_url),
        )
    else:
        await db.set_payment_method(oid, cb.from_user.id, "card")
        card = (await db.get_setting("card_details")).strip() or "—"
        amount = fmt_usd(order["total_cents"])
        rate = parse_rate(await db.get_setting("uah_rate"))
        if rate:
            amount = f"{usd_to_uah(order['total_cents'], rate):,} ₴ ({amount})".replace(",", " ")
        await state.set_state(Flow.proof)
        await state.update_data(order_id=oid)
        await cb.message.answer(t("card_instructions", lang, amount=amount, card=escape(card), id=oid))
    await refresh_team_card(bot, cfg, db, oid)
    await cb.answer()


@router.message(Flow.proof, F.photo | F.document)
async def on_proof(message: Message, state: FSMContext, db: Database, bot: Bot, cfg: Config) -> None:
    lang = await get_lang(state, db, message.from_user.id)
    oid = (await state.get_data()).get("order_id")
    order = await db.order(oid) if oid else None
    if order is None or order["customer_id"] != message.from_user.id:
        await state.set_state(None)
        await message.answer(t("session_expired", lang))
        return
    updated = await db.transition(oid, ("awaiting_payment",), "payment_review", message.from_user.id, "card proof")
    if updated is None:
        await state.set_state(None)
        await message.answer(t("order_not_payable", lang))
        return
    await state.set_state(None)
    await refresh_team_card(bot, cfg, db, oid, "Клиент прислал подтверждение оплаты 👇")
    order = await db.order(oid)
    try:
        await bot.copy_message(
            cfg.team_chat_id, message.chat.id, message.message_id,
            caption=f"🧾 Оплата по заказу #{oid}",
            reply_parameters=ReplyParameters(message_id=order["team_message_id"], allow_sending_without_reply=True)
            if order["team_message_id"] else None,
        )
    except Exception:
        log.exception("Could not forward payment proof for order %s", oid)
    await message.answer(t("proof_received", lang), reply_markup=home_kb(lang))


@router.message(Flow.proof)
async def on_proof_wrong(message: Message, state: FSMContext, db: Database) -> None:
    await message.answer(t("need_proof", await get_lang(state, db, message.from_user.id)))
