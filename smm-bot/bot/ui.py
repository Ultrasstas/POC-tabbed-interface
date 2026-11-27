"""Keyboards, callback data and message rendering."""
from __future__ import annotations

from html import escape

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from .money import fmt_usd
from .texts import item_label, t


# ---------- callback data ----------
class LangCb(CallbackData, prefix="lang"):
    code: str


class MenuCb(CallbackData, prefix="menu"):
    action: str  # new | orders | support | lang | home


class SvcCb(CallbackData, prefix="svc"):
    code: str


class PkgCb(CallbackData, prefix="pkg"):
    id: int


class CartCb(CallbackData, prefix="cart"):
    action: str  # add | checkout | rm | cancel
    idx: int = 0


class FlowCb(CallbackData, prefix="flow"):
    action: str  # skip_notes | confirm | cancel


class PayCb(CallbackData, prefix="pay"):
    method: str  # card | crypto
    order_id: int


class TeamCb(CallbackData, prefix="team"):
    action: str  # confirm_pay | reject_pay | take | done | cancel
    order_id: int


# ---------- customer keyboards ----------
def lang_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text="🇷🇺 Русский", callback_data=LangCb(code="ru"))
    b.button(text="🇺🇦 Українська", callback_data=LangCb(code="uk"))
    b.button(text="🇬🇧 English", callback_data=LangCb(code="en"))
    b.adjust(1)
    return b.as_markup()


def menu_kb(lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_new_order", lang), callback_data=MenuCb(action="new"))
    b.button(text=t("btn_my_orders", lang), callback_data=MenuCb(action="orders"))
    b.button(text=t("btn_support", lang), callback_data=MenuCb(action="support"))
    b.button(text=t("btn_language", lang), callback_data=MenuCb(action="lang"))
    b.adjust(1, 2, 1)
    return b.as_markup()


def home_kb(lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_menu", lang), callback_data=MenuCb(action="home"))
    return b.as_markup()


def services_kb(services, lang: str, has_cart: bool) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    for s in services:
        b.button(text=s["name_" + lang], callback_data=SvcCb(code=s["code"]))
    if has_cart:
        b.button(text=t("btn_back", lang), callback_data=CartCb(action="show"))
    else:
        b.button(text=t("btn_back", lang), callback_data=MenuCb(action="home"))
    b.adjust(1)
    return b.as_markup()


def packages_kb(service, packages, lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    unit = service["unit_" + lang]
    for p in packages:
        b.button(text=f"{p['quantity']:,} {unit} — {fmt_usd(p['price_cents'])}", callback_data=PkgCb(id=p["id"]))
    b.button(text=t("btn_back", lang), callback_data=MenuCb(action="new"))
    b.adjust(1)
    return b.as_markup()


def cart_kb(lines, lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_add_more", lang), callback_data=CartCb(action="add"))
    b.button(text=t("btn_checkout", lang), callback_data=CartCb(action="checkout"))
    for i, row in enumerate(lines):
        b.button(text=t("btn_remove", lang, item=item_label(row, lang)), callback_data=CartCb(action="rm", idx=i))
    b.button(text=t("btn_cancel", lang), callback_data=CartCb(action="cancel"))
    b.adjust(2, *([1] * (len(lines) + 1)))
    return b.as_markup()


def skip_kb(lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_skip", lang), callback_data=FlowCb(action="skip_notes"))
    return b.as_markup()


def confirm_kb(lang: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_confirm", lang), callback_data=FlowCb(action="confirm"))
    b.button(text=t("btn_cancel", lang), callback_data=FlowCb(action="cancel"))
    b.adjust(1)
    return b.as_markup()


def payment_kb(order_id: int, lang: str, crypto_enabled: bool) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=t("btn_pay_card", lang), callback_data=PayCb(method="card", order_id=order_id))
    if crypto_enabled:
        b.button(text=t("btn_pay_crypto", lang), callback_data=PayCb(method="crypto", order_id=order_id))
    b.adjust(1)
    return b.as_markup()


def url_kb(text: str, url: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.button(text=text, url=url)
    return b.as_markup()


# ---------- customer texts ----------
def cart_text(lines, lang: str) -> str:
    if not lines:
        return t("cart_empty", lang)
    rows = [t("cart_title", lang)]
    for row in lines:
        rows.append(f"• {escape(item_label(row, lang))} — {fmt_usd(row['price_cents'])}")
    rows.append("")
    rows.append(t("cart_total", lang, total=fmt_usd(sum(r["price_cents"] for r in lines))))
    rows.append("")
    rows.append(t("cart_more_q", lang))
    return "\n".join(rows)


def summary_text(username: str, lines, items_data, lang: str) -> str:
    rows = [t("summary_title", lang), "", t("summary_account", lang, username=escape(username)), ""]
    for row, data in zip(lines, items_data):
        rows.append(f"• {escape(item_label(row, lang))} — {fmt_usd(row['price_cents'])}")
        if data.get("url"):
            rows.append(f"   🔗 {escape(data['url'])}")
        if data.get("notes"):
            rows.append(f"   💬 {escape(data['notes'])}")
    rows.append("")
    rows.append(t("cart_total", lang, total=fmt_usd(sum(r["price_cents"] for r in lines))))
    rows.append("")
    rows.append(t("summary_footer", lang))
    return "\n".join(rows)


# ---------- team (always Russian) ----------
TEAM_STATUS = {
    "awaiting_payment": "⏳ Ждёт оплату",
    "payment_review": "🔎 Проверить оплату",
    "paid": "✅ Оплачен, можно брать",
    "in_progress": "🚀 В работе",
    "done": "🎉 Выполнен",
    "cancelled": "❌ Отменён",
    "rejected": "⛔ Оплата отклонена",
}
TEAM_METHOD = {"card": "💳 перевод на карту", "crypto": "🪙 крипта", None: "ещё не выбран"}


def team_order_text(order, items, last_action: str | None = None) -> str:
    who = escape(order["first_name"] or "—")
    if order["tg_username"]:
        who += f" (@{escape(order['tg_username'])})"
    ig = escape(order["ig_username"])
    rows = [
        f"<b>Заказ #{order['id']}</b> · {TEAM_STATUS.get(order['status'], order['status'])}",
        "",
        f"👤 Клиент: {who}, <code>{order['customer_id']}</code>",
        f"📸 Instagram: <a href=\"https://www.instagram.com/{ig}/\">@{ig}</a>",
        "",
    ]
    for it in items:
        rows.append(f"• {escape(item_label(it, 'ru'))} — {fmt_usd(it['price_cents'])}")
        if it["post_url"]:
            rows.append(f"   🔗 {escape(it['post_url'])}")
        if it["notes"]:
            rows.append(f"   💬 {escape(it['notes'])}")
    rows += [
        "",
        f"💰 Итого: <b>{fmt_usd(order['total_cents'])}</b>",
        f"Оплата: {TEAM_METHOD.get(order['payment_method'], order['payment_method'])}",
    ]
    if last_action:
        rows.append(f"\n<i>{escape(last_action)}</i>")
    return "\n".join(rows)


def team_kb(order) -> InlineKeyboardMarkup | None:
    oid, st = order["id"], order["status"]
    b = InlineKeyboardBuilder()
    if st == "awaiting_payment":
        b.button(text="✅ Оплата получена", callback_data=TeamCb(action="confirm_pay", order_id=oid))
        b.button(text="❌ Отменить", callback_data=TeamCb(action="cancel", order_id=oid))
    elif st == "payment_review":
        b.button(text="✅ Подтвердить оплату", callback_data=TeamCb(action="confirm_pay", order_id=oid))
        b.button(text="⛔ Отклонить", callback_data=TeamCb(action="reject_pay", order_id=oid))
    elif st == "paid":
        b.button(text="🚀 Взять в работу", callback_data=TeamCb(action="take", order_id=oid))
        b.button(text="🎉 Выполнено", callback_data=TeamCb(action="done", order_id=oid))
        b.button(text="❌ Отменить", callback_data=TeamCb(action="cancel", order_id=oid))
    elif st == "in_progress":
        b.button(text="🎉 Выполнено", callback_data=TeamCb(action="done", order_id=oid))
        b.button(text="❌ Отменить", callback_data=TeamCb(action="cancel", order_id=oid))
    else:
        return None
    b.adjust(2)
    return b.as_markup()
