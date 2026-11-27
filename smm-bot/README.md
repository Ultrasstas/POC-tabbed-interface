# SMM-бот для Instagram

Telegram-бот: клиент выбирает услуги и пакеты, бот считает сумму, принимает оплату
(перевод на карту или крипта через @CryptoBot) и передаёт заказ в группу команды.

Подробности о продукте: [docs/DISCOVERY.md](docs/DISCOVERY.md).

## Как устроено

| Файл | Что делает |
|---|---|
| `bot/handlers/client.py` | Сценарий клиента: язык → услуги → корзина → ник → ссылки → оплата |
| `bot/handlers/team.py` | Кнопки статусов в группе команды, команды админа, поддержка |
| `bot/db.py` | Работа с базой: заказы, цены, атомарная смена статусов |
| `bot/texts.py` | Все тексты на RU / UA / EN |
| `bot/cryptopay.py` | Счета в Crypto Pay и проверка оплаты |
| `migrations/` | Таблицы и каталог с ценами (применяются автоматически при запуске) |

## Запуск на Railway

1. New Project → Deploy from GitHub repo → этот репозиторий.
2. Settings → **Root Directory**: `smm-bot`.
3. Variables: заполнить переменные из `.env.example`.
4. Deploy. Таблицы и каталог создадутся сами при первом запуске.

## Команды

Для всех: `/start`, `/orders`, `/support`, `/language`, `/id`.

Для команды (в личке с ботом):
- `/setcard <реквизиты>`: номер карты, который видят клиенты.
- `/setrate <курс>`: курс гривны, чтобы показывать сумму в ₴ (`/setrate off` выключает).
- `/setsupport <@контакт>`: контакт поддержки. Если пусто, вопросы клиентов приходят в группу, отвечать на них через Reply.
- `/settings`, `/active`: текущие настройки и активные заказы.

## Как поменять цены

Supabase → Table Editor → схема `smm` → таблица `packages` → колонка `price_cents`
(в центах: `4500` = $45.00). Чтобы скрыть пакет или услугу, поставьте `is_active = false`.

## Тесты

```bash
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://user:pass@localhost/test pytest
```
