# Doma Mini App

Telegram Mini App для замовлення їжі з **Doma Pizza** та **Doma Croissants** (Вишгород).
Обсяг MVP і беклог — у [Development.md](Development.md).

## Структура

```
api/        FastAPI — REST для Mini App (валідація initData, каталог, кошик)
bot/        aiogram — точка входу /start із кнопкою Mini App, надалі нотифікації
frontend/   React + TS + Vite — сам Mini App (ще не заскафолджено)
db/         SQL-міграції та сид каталогу
nginx/      Прод-образ: збірка фронтенду + віддача статики + проксі /api
scripts/    Dev-утиліти
```

## Запуск для розробки

```bash
cp .env.example .env        # підставити реальні DATABASE_URL, BOT_TOKEN, MINI_APP_URL

# міграції та тестові дані (одноразово)
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -f db/seed/seed_catalog.sql

docker compose -f docker-compose.dev.yml up --build
```

Підіймаються `redis`, `api` (http://localhost:8010, Swagger на `/docs`) та `bot`.
Postgres — зовнішній, з `DATABASE_URL`.

> Порт API на хості — **8010**, бо 8000 зайнятий portainer.

Фронтенд поки за окремим профілем (запрацює після скафолдингу):

```bash
docker compose -f docker-compose.dev.yml --profile frontend up
```

### Тестування API без Telegram

Кожен захищений ендпоінт вимагає заголовок `X-Telegram-Init-Data`. Згенерувати валідний:

```bash
python3 scripts/generate_test_init_data.py "$BOT_TOKEN"
```

Отриманий рядок вставити у Swagger (`/docs` → Authorize) або в curl:

```bash
curl http://localhost:8010/api/me -H "X-Telegram-Init-Data: <рядок>"
```

## API

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/health` | healthcheck |
| POST | `/api/register` | створити/оновити профіль |
| GET | `/api/me` | профіль поточного користувача |
| GET | `/api/categories` | категорії обох закладів |
| GET | `/api/categories/{id}/products` | товари категорії |
| GET | `/api/products/{id}` | картка товару з варіантами |
| GET | `/api/cart` | вміст кошика |
| POST | `/api/cart/items` | додати позицію |
| PATCH | `/api/cart/items/{id}` | змінити кількість |
| DELETE | `/api/cart/items/{id}` | видалити позицію |
| DELETE | `/api/cart` | очистити кошик |
| GET | `/api/locations` | контакти закладів |

Авторизації через логін/пароль немає: `telegram_id` дістається з підписаного
`initData`, підпис перевіряється HMAC-ом на `BOT_TOKEN`.

## Деплой

```bash
docker compose up -d --build
```

nginx слухає 80 і віддає зібраний фронтенд; TLS термінує зовнішній
reverse-proxy або тунель (BotFather вимагає HTTPS-URL для Mini App).
