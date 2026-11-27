"""All customer-facing texts in Russian, Ukrainian and English."""
from __future__ import annotations

LANGS = ("ru", "uk", "en")
DEFAULT_LANG = "ru"

T: dict[str, dict[str, str]] = {
    "choose_lang": {
        "ru": "Выберите язык / Оберіть мову / Choose language",
        "uk": "Выберите язык / Оберіть мову / Choose language",
        "en": "Выберите язык / Оберіть мову / Choose language",
    },
    "menu": {
        "ru": "👋 Здравствуйте! Здесь можно заказать продвижение в Instagram: подписчики, лайки, просмотры и комментарии.\n\n🔒 Мы <b>никогда</b> не просим пароль: нужен только ник или ссылка на пост.",
        "uk": "👋 Вітаємо! Тут можна замовити просування в Instagram: підписники, лайки, перегляди та коментарі.\n\n🔒 Ми <b>ніколи</b> не просимо пароль: потрібен лише нік або посилання на пост.",
        "en": "👋 Hello! Here you can order Instagram growth: followers, likes, views and comments.\n\n🔒 We <b>never</b> ask for your password: we only need your username or a post link.",
    },
    "btn_new_order": {"ru": "🛒 Новый заказ", "uk": "🛒 Нове замовлення", "en": "🛒 New order"},
    "btn_my_orders": {"ru": "📦 Мои заказы", "uk": "📦 Мої замовлення", "en": "📦 My orders"},
    "btn_support": {"ru": "💬 Поддержка", "uk": "💬 Підтримка", "en": "💬 Support"},
    "btn_language": {"ru": "🌐 Язык", "uk": "🌐 Мова", "en": "🌐 Language"},
    "btn_back": {"ru": "⬅️ Назад", "uk": "⬅️ Назад", "en": "⬅️ Back"},
    "btn_menu": {"ru": "🏠 Меню", "uk": "🏠 Меню", "en": "🏠 Menu"},
    "choose_service": {
        "ru": "Какую услугу хотите заказать?",
        "uk": "Яку послугу бажаєте замовити?",
        "en": "Which service would you like?",
    },
    "choose_package": {
        "ru": "<b>{service}</b>\nВыберите количество:",
        "uk": "<b>{service}</b>\nОберіть кількість:",
        "en": "<b>{service}</b>\nChoose the amount:",
    },
    "cart_title": {"ru": "🧺 <b>Ваш заказ:</b>", "uk": "🧺 <b>Ваше замовлення:</b>", "en": "🧺 <b>Your order:</b>"},
    "cart_total": {"ru": "<b>Итого: {total}</b>", "uk": "<b>Разом: {total}</b>", "en": "<b>Total: {total}</b>"},
    "cart_empty": {"ru": "Корзина пуста.", "uk": "Кошик порожній.", "en": "Your cart is empty."},
    "cart_more_q": {
        "ru": "Добавить ещё услугу?", "uk": "Додати ще послугу?", "en": "Add another service?",
    },
    "btn_add_more": {"ru": "➕ Добавить ещё", "uk": "➕ Додати ще", "en": "➕ Add more"},
    "btn_checkout": {"ru": "✅ Оформить заказ", "uk": "✅ Оформити замовлення", "en": "✅ Checkout"},
    "btn_remove": {"ru": "✖️ Убрать: {item}", "uk": "✖️ Прибрати: {item}", "en": "✖️ Remove: {item}"},
    "btn_cancel": {"ru": "❌ Отменить", "uk": "❌ Скасувати", "en": "❌ Cancel"},
    "cart_full": {
        "ru": "В заказе может быть не больше {n} позиций.",
        "uk": "У замовленні може бути не більше {n} позицій.",
        "en": "An order can contain at most {n} items.",
    },
    "ask_username": {
        "ru": "Напишите <b>ник Instagram</b> (например, <code>@my_brand</code>) или ссылку на профиль.\n\n⚠️ Аккаунт должен быть <b>открытым</b> на время выполнения заказа.",
        "uk": "Напишіть <b>нік Instagram</b> (наприклад, <code>@my_brand</code>) або посилання на профіль.\n\n⚠️ Акаунт має бути <b>відкритим</b> під час виконання замовлення.",
        "en": "Send your <b>Instagram username</b> (e.g. <code>@my_brand</code>) or a profile link.\n\n⚠️ The account must be <b>public</b> while the order is being delivered.",
    },
    "bad_username": {
        "ru": "Не похоже на ник Instagram. Ник: до 30 символов, латинские буквы, цифры, точка и подчёркивание. Попробуйте ещё раз.",
        "uk": "Не схоже на нік Instagram. Нік: до 30 символів, латинські літери, цифри, крапка та підкреслення. Спробуйте ще раз.",
        "en": "That doesn't look like an Instagram username: up to 30 characters, Latin letters, digits, dot and underscore. Please try again.",
    },
    "ask_link": {
        "ru": "Пришлите <b>ссылку на пост или Reels</b> для:\n<b>{item}</b>\n\nПример: <code>https://www.instagram.com/p/ABC123xyz/</code>",
        "uk": "Надішліть <b>посилання на пост або Reels</b> для:\n<b>{item}</b>\n\nПриклад: <code>https://www.instagram.com/p/ABC123xyz/</code>",
        "en": "Send the <b>post or Reel link</b> for:\n<b>{item}</b>\n\nExample: <code>https://www.instagram.com/p/ABC123xyz/</code>",
    },
    "bad_link": {
        "ru": "Это не ссылка на пост Instagram. Откройте пост → «Поделиться» → «Копировать ссылку» и пришлите её сюда.",
        "uk": "Це не посилання на пост Instagram. Відкрийте пост → «Поділитися» → «Копіювати посилання» і надішліть його сюди.",
        "en": "That's not an Instagram post link. Open the post → Share → Copy link, and paste it here.",
    },
    "ask_notes": {
        "ru": "💬 Пожелания к комментариям для <b>{item}</b>?\nНапример: тематика, язык, эмодзи. Или нажмите «Пропустить»: напишем позитивные комментарии по теме поста.",
        "uk": "💬 Побажання до коментарів для <b>{item}</b>?\nНаприклад: тематика, мова, емодзі. Або натисніть «Пропустити»: напишемо позитивні коментарі за темою посту.",
        "en": "💬 Any wishes for the comments on <b>{item}</b>?\nE.g. topic, language, emojis. Or tap Skip and we'll write positive comments that fit the post.",
    },
    "btn_skip": {"ru": "⏭ Пропустить", "uk": "⏭ Пропустити", "en": "⏭ Skip"},
    "summary_title": {"ru": "📋 <b>Проверьте заказ</b>", "uk": "📋 <b>Перевірте замовлення</b>", "en": "📋 <b>Please check your order</b>"},
    "summary_account": {"ru": "Аккаунт: <b>@{username}</b>", "uk": "Акаунт: <b>@{username}</b>", "en": "Account: <b>@{username}</b>"},
    "summary_footer": {
        "ru": "Доставка идёт постепенно, чтобы выглядеть естественно. Если в течение 30 дней часть отвалится, восполним бесплатно.",
        "uk": "Доставка йде поступово, щоб виглядати природно. Якщо протягом 30 днів частина зникне, відновимо безкоштовно.",
        "en": "Delivery is gradual so it looks natural. If anything drops within 30 days, we refill it for free.",
    },
    "btn_confirm": {"ru": "✅ Всё верно, к оплате", "uk": "✅ Усе вірно, до оплати", "en": "✅ Looks good, pay"},
    "choose_payment": {
        "ru": "Заказ <b>#{id}</b> создан. Сумма: <b>{total}</b>\nКак удобнее оплатить?",
        "uk": "Замовлення <b>#{id}</b> створено. Сума: <b>{total}</b>\nЯк зручніше оплатити?",
        "en": "Order <b>#{id}</b> created. Amount: <b>{total}</b>\nHow would you like to pay?",
    },
    "btn_pay_card": {"ru": "💳 Перевод на карту", "uk": "💳 Переказ на картку", "en": "💳 Card transfer"},
    "btn_pay_crypto": {"ru": "🪙 Криптовалюта (USDT)", "uk": "🪙 Криптовалюта (USDT)", "en": "🪙 Crypto (USDT)"},
    "card_instructions": {
        "ru": "💳 <b>Оплата переводом на карту</b>\n\nСумма: <b>{amount}</b>\nРеквизиты:\n<code>{card}</code>\n\nВ комментарии к переводу укажите: <code>#{id}</code>\n\nПосле оплаты <b>пришлите сюда скриншот или квитанцию</b>.",
        "uk": "💳 <b>Оплата переказом на картку</b>\n\nСума: <b>{amount}</b>\nРеквізити:\n<code>{card}</code>\n\nУ коментарі до переказу вкажіть: <code>#{id}</code>\n\nПісля оплати <b>надішліть сюди скріншот або квитанцію</b>.",
        "en": "💳 <b>Pay by card transfer</b>\n\nAmount: <b>{amount}</b>\nDetails:\n<code>{card}</code>\n\nPut <code>#{id}</code> in the transfer comment.\n\nAfter paying, <b>send a screenshot or receipt here</b>.",
    },
    "need_proof": {
        "ru": "Пришлите, пожалуйста, скриншот или квитанцию об оплате (фото или файл).",
        "uk": "Надішліть, будь ласка, скріншот або квитанцію про оплату (фото або файл).",
        "en": "Please send a screenshot or receipt of the payment (photo or file).",
    },
    "proof_received": {
        "ru": "🙏 Спасибо! Проверяем оплату, обычно это занимает до 30 минут. Сообщим, как только подтвердим.",
        "uk": "🙏 Дякуємо! Перевіряємо оплату, зазвичай це займає до 30 хвилин. Повідомимо, щойно підтвердимо.",
        "en": "🙏 Thanks! We're checking the payment, it usually takes up to 30 minutes. We'll let you know.",
    },
    "crypto_invoice": {
        "ru": "🪙 Счёт на <b>{amount}</b> создан. Нажмите кнопку ниже и оплатите в @CryptoBot. Оплата подтвердится автоматически.",
        "uk": "🪙 Рахунок на <b>{amount}</b> створено. Натисніть кнопку нижче й оплатіть у @CryptoBot. Оплата підтвердиться автоматично.",
        "en": "🪙 Invoice for <b>{amount}</b> created. Tap the button below and pay in @CryptoBot. Payment is confirmed automatically.",
    },
    "btn_open_invoice": {"ru": "Оплатить в CryptoBot", "uk": "Оплатити в CryptoBot", "en": "Pay in CryptoBot"},
    "crypto_unavailable": {
        "ru": "Оплата криптовалютой временно недоступна. Выберите перевод на карту.",
        "uk": "Оплата криптовалютою тимчасово недоступна. Оберіть переказ на картку.",
        "en": "Crypto payment is temporarily unavailable. Please use card transfer.",
    },
    "order_unavailable": {
        "ru": "Часть услуг в корзине больше недоступна или цена изменилась. Соберите заказ заново, пожалуйста.",
        "uk": "Частина послуг у кошику більше недоступна або ціна змінилася. Зберіть замовлення заново, будь ласка.",
        "en": "Some items are no longer available or the price changed. Please build the order again.",
    },
    "order_not_payable": {
        "ru": "Этот заказ уже нельзя оплатить. Откройте «Мои заказы».",
        "uk": "Це замовлення вже не можна оплатити. Відкрийте «Мої замовлення».",
        "en": "This order can no longer be paid. See “My orders”.",
    },
    "cancelled": {"ru": "Заказ отменён.", "uk": "Замовлення скасовано.", "en": "Order cancelled."},
    "my_orders_empty": {"ru": "У вас пока нет заказов.", "uk": "У вас поки немає замовлень.", "en": "You have no orders yet."},
    "my_orders_title": {"ru": "📦 <b>Ваши заказы</b>", "uk": "📦 <b>Ваші замовлення</b>", "en": "📦 <b>Your orders</b>"},
    "support": {
        "ru": "💬 По любым вопросам пишите: {contact}",
        "uk": "💬 З будь-яких питань пишіть: {contact}",
        "en": "💬 For any questions, contact: {contact}",
    },
    "support_none": {
        "ru": "💬 Напишите ваш вопрос прямо сюда, менеджер свяжется с вами.",
        "uk": "💬 Напишіть ваше питання прямо сюди, менеджер зв'яжеться з вами.",
        "en": "💬 Write your question here and a manager will contact you.",
    },
    "unknown": {
        "ru": "Нажмите /start, чтобы открыть меню.",
        "uk": "Натисніть /start, щоб відкрити меню.",
        "en": "Press /start to open the menu.",
    },
    "too_fast": {
        "ru": "Слишком много сообщений, подождите пару секунд.",
        "uk": "Забагато повідомлень, зачекайте кілька секунд.",
        "en": "Too many messages, please wait a few seconds.",
    },
    "session_expired": {
        "ru": "Сессия устарела. Начните заказ заново: /start",
        "uk": "Сесія застаріла. Почніть замовлення заново: /start",
        "en": "Session expired. Please start again: /start",
    },
    # status names
    "st_awaiting_payment": {"ru": "⏳ ожидает оплаты", "uk": "⏳ очікує оплати", "en": "⏳ awaiting payment"},
    "st_payment_review": {"ru": "🔎 оплата на проверке", "uk": "🔎 оплата на перевірці", "en": "🔎 payment under review"},
    "st_paid": {"ru": "✅ оплачен", "uk": "✅ оплачено", "en": "✅ paid"},
    "st_in_progress": {"ru": "🚀 в работе", "uk": "🚀 у роботі", "en": "🚀 in progress"},
    "st_done": {"ru": "🎉 выполнен", "uk": "🎉 виконано", "en": "🎉 completed"},
    "st_cancelled": {"ru": "❌ отменён", "uk": "❌ скасовано", "en": "❌ cancelled"},
    "st_rejected": {"ru": "⛔ оплата не подтверждена", "uk": "⛔ оплату не підтверджено", "en": "⛔ payment not confirmed"},
    # notifications to the customer
    "notify_paid": {
        "ru": "✅ Оплата заказа <b>#{id}</b> подтверждена! Скоро начнём.",
        "uk": "✅ Оплату замовлення <b>#{id}</b> підтверджено! Скоро почнемо.",
        "en": "✅ Payment for order <b>#{id}</b> confirmed! We'll start soon.",
    },
    "notify_in_progress": {
        "ru": "🚀 Заказ <b>#{id}</b> в работе.",
        "uk": "🚀 Замовлення <b>#{id}</b> у роботі.",
        "en": "🚀 Order <b>#{id}</b> is in progress.",
    },
    "notify_done": {
        "ru": "🎉 Заказ <b>#{id}</b> выполнен! Если в течение 30 дней что-то отвалится, напишите нам, восполним бесплатно.",
        "uk": "🎉 Замовлення <b>#{id}</b> виконано! Якщо протягом 30 днів щось зникне, напишіть нам, відновимо безкоштовно.",
        "en": "🎉 Order <b>#{id}</b> is complete! If anything drops within 30 days, message us for a free refill.",
    },
    "notify_rejected": {
        "ru": "⛔ Не удалось подтвердить оплату заказа <b>#{id}</b>. Если вы оплатили, свяжитесь с поддержкой.",
        "uk": "⛔ Не вдалося підтвердити оплату замовлення <b>#{id}</b>. Якщо ви оплатили, зв'яжіться з підтримкою.",
        "en": "⛔ We couldn't confirm the payment for order <b>#{id}</b>. If you paid, please contact support.",
    },
    "notify_cancelled": {
        "ru": "❌ Заказ <b>#{id}</b> отменён. Вопросы: «Поддержка».",
        "uk": "❌ Замовлення <b>#{id}</b> скасовано. Питання: «Підтримка».",
        "en": "❌ Order <b>#{id}</b> was cancelled. Questions: “Support”.",
    },
}


def t(key: str, lang: str | None, **kwargs) -> str:
    entry = T[key]
    text = entry.get(lang or DEFAULT_LANG) or entry[DEFAULT_LANG]
    return text.format(**kwargs) if kwargs else text


def item_label(row, lang: str | None) -> str:
    """'Followers: 1,000' style label from a row with name_*/unit_* and quantity."""
    lang = lang if lang in LANGS else DEFAULT_LANG
    return f"{row['name_' + lang]}: {row['quantity']:,} {row['unit_' + lang]}".strip()
