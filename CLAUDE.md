# Doma Bot → Telegram Mini App — контекст проєкту

> Файл-пам'ять для Claude Code. Оновлювати при зміні стану проєкту.
> Обсяг MVP і фази — у [Development.md](Development.md), інструкції запуску — у [README.md](README.md).

---

## 1. Формат роботи — читати першим

Проєкт **навчальний**. Мета користувача — розібратись у технологіях самостійно,
а не отримати готовий продукт.

**Цикл:** пояснення теорії → конкретне ТЗ на один файл/функцію → **користувач пише код сам**
→ рев'ю з поясненням неточностей → користувач виправляє → наступний крок.

**Не писати код за користувача.** Виняток — там, де немає навчальної цінності:
dev-скрипти, `docker-compose`, `Dockerfile`, `requirements.txt`, базовий каркас конфігів.

Давати **один файл за раз**, не вивалювати одразу весь модуль.

> ⚠️ У сесії 2026-09-02 цей формат було порушено: Claude написав бекенд, бота, nginx,
> CI і документацію самостійно. Причина — запит звучав як «продовжимо роботу»,
> без згадки про навчальний формат. Далі повертаємось до циклу вище.

### Роль користувача

Олександр, Chapter Lead Ops. Мета — вивчення нових технологій, автоматизація, саморозвиток.
Мова спілкування, коментарів у коді та комітів — **українська**.

---

## 2. Що це за проєкт

Перенесення UX замовлення їжі з існуючого Telegram-бота **doma-bot** (aiogram) у
**Telegram Mini App**. Два заклади: **Doma Pizza** та **Doma Croissants** (Вишгород).

Сценарій: категорія → товар → розмір (варіанти з різними цінами) → кошик → контакти.

Пишеться **з нуля** — код існуючого бота не переноситься.

### MVP

1. Реєстрація клієнта (ім'я, телефон, адреса доставки)
2. Вибір позицій і розмірів → заповнення кошика
3. Маніпуляція кошиком (зміна qty, видалення позиції, очищення)
4. Вкладка «Контакти»

**Поза MVP:** checkout, історія замовлень, оплата (фізична й Telegram Payments),
розбиття кошика по закладах, модерація адреси менеджером.

---

## 3. Поточний стан (2026-09-02)

| Компонент | Стан |
|---|---|
| БД: схема + сид | ✅ застосовано на живому сервері |
| API: усі 12 ендпоінтів | ✅ реалізовано, перевірено наскрізно вручну |
| Бот: `/start` + Menu Button | ✅ працює, перевірено в polling |
| nginx + обидва compose | ✅ перевірено в докері |
| Git, ліцензія, README, CI | ✅ готово до публікації |
| **Frontend** | ❌ **0 файлів** — лише порожні директорії |
| **Автотести** | ❌ **немає жодного** |

**Лишилось для MVP: тільки фронтенд.**

4 коміти в `main`, репозиторій ще не запушений на GitHub
(планований remote: `Oleksandr-Nikiha/doma_app`).

---

## 4. Стек

| Шар | Технології |
|---|---|
| API | FastAPI 0.115, Pydantic 2.9.2, pydantic-settings, asyncpg 0.29 |
| Бот | aiogram 3.31 |
| Фронтенд | React + TS + Vite, `@telegram-apps/sdk`, `@telegram-apps/telegram-ui`, TailwindCSS, TanStack Query |
| Сховище | PostgreSQL (**зовнішній сервер користувача**, DSN у `.env`), Redis |
| Інфра | Docker Compose, nginx, ruff 0.16.5 |

**PostgreSQL у compose не піднімається** — використовується зовнішній сервер користувача,
адмінка pgAdmin (уже розгорнута). Redis у compose є, але **кодом ще не використовується** —
кошик одразу в Postgres, як і планувалось для MVP.

---

## 5. Структура

```
doma_app/
├── CLAUDE.md, README.md, CONTRIBUTING.md, Development.md, LICENSE
├── ruff.toml                     набір правил зафіксовано явно; B008 вимкнено
├── .dockerignore                 + api/.dockerignore, bot/.dockerignore
├── docker-compose.dev.yml        redis + api + bot; frontend за профілем
├── docker-compose.yml            прод: redis + api + bot + nginx
├── .github/workflows/ci.yml      lint, imports, infra, build, secrets
├── scripts/generate_test_init_data.py    генерація підписаного initData для тестів
├── db/
│   ├── migrations/0001_init.sql  users, locations, categories, products,
│   │                             product_variants, carts, cart_items
│   └── seed/seed_catalog.sql     Doma Pizza / Croissants, Il Tonna тощо
├── api/src/
│   ├── main.py                   lifespan, CORS, 4 роутери
│   ├── config.py                 pydantic-settings + cors_origins
│   ├── auth/telegram_init_data.py   validate_init_data() — HMAC за алгоритмом Telegram
│   ├── auth/deps.py              APIKeyHeader, get_init_data(), get_current_user()
│   ├── db/connection.py          get_pool(), connect_db(), disconnect_db()
│   ├── db/cart_repo.py           get_or_create_cart_id() — атомарний upsert
│   ├── schemas/                  catalog.py, user.py, cart.py, location.py
│   └── routers/                  catalog.py, users.py, cart.py, locations.py
├── bot/src/
│   ├── main.py                   polling, set_chat_menu_button, connect_db
│   ├── config.py                 bot_token, mini_app_url, database_url
│   ├── handlers/start.py         /start + інлайн-кнопка WebApp
│   └── db/connection.py          пул + get_user_by_telegram_id()
├── nginx/{nginx.conf,Dockerfile} SPA + проксі /api; multi-stage збірка Vite
└── frontend/                     ПОРОЖНЬО: src/{api,components,pages,store,styles,telegram}
```

---

## 6. Модель даних

```
locations         id, name, address, phones TEXT[]
users             id, telegram_id UNIQUE, full_name, phone, delivery_address
categories        id, location_id FK, name, icon, sort_order
products          id, category_id FK, name, description, image_url, sort_order
product_variants  id, product_id FK, label, weight, price NUMERIC(10,2), sort_order
carts             id, telegram_id UNIQUE FK→users.telegram_id
cart_items        id, cart_id FK, variant_id FK, qty CHECK(qty>0), UNIQUE(cart_id, variant_id)
```

Кожна зміна схеми — **новим файлом** `db/migrations/000N_опис.sql`.
Застосовані міграції не редагуються.

---

## 7. API

Захищені (потребують `X-Telegram-Init-Data`, інакше `401`):
`POST /api/register`, `GET /api/me`, `GET|DELETE /api/cart`,
`POST /api/cart/items`, `PATCH|DELETE /api/cart/items/{id}`

Публічні: `GET /api/health`, `/api/categories`, `/api/categories/{id}/products`,
`/api/products/{id}`, `/api/locations`

Окремої авторизації немає: `telegram_id` дістається з підписаного `initData`.

---

## 8. Ключові рішення й граблі

**Імпорти.** У контейнері код лежить у `/app/src/...`, тож **усі імпорти починаються з `src.`**
(`from src.config import get_settings`), **без префіксу `api.`**. Це повторювана помилка —
перевіряти в першу чергу при `ModuleNotFoundError`.

**`DATABASE_URL`.** Якщо пароль містить `@ : / ? #` — url-encode (`urllib.parse.quote`),
**без лапок** навколо значення в `.env`.

**Валідація `initData`.** Власна реалізація за офіційним алгоритмом Telegram: HMAC-SHA256
у два кроки (secret_key з `"WebAppData"` → хеш `data_check_string`), `hmac.compare_digest`
проти timing-атак, перевірка `auth_date` на протухання (24 год).

**Race condition у кошику.** `get_or_create_cart_id` — `INSERT ... ON CONFLICT (telegram_id)
DO UPDATE SET telegram_id = EXCLUDED.telegram_id RETURNING id`: трюк, що завжди повертає
рядок, на відміну від `DO NOTHING`.

**Upsert позиції.** `ON CONFLICT (cart_id, variant_id) DO UPDATE SET qty = cart_items.qty
+ EXCLUDED.qty` — повторне додавання збільшує кількість, не дублює рядок.

**Належність рядка юзеру.** Усі мутації `cart_items` йдуть через `JOIN carts` з умовою
`carts.telegram_id = $N` — інакше підміною `item_id` можна редагувати чужий кошик.

**`Depends()` у дефолтах аргументів** — штатний ідіом FastAPI. Ruff лає це як B008;
правило вимкнено в `ruff.toml`, бо для цього проєкту це хибне спрацювання.

**`APIKeyHeader`, а не `Header(...)`.** Дає кнопку Authorize у Swagger. `auto_error=False`,
бо дефолт APIKeyHeader — 403; відсутній і невалідний initData обидва дають 401.

**nginx і upstream.** Адреса `api` резолвиться в рантаймі (`resolver 127.0.0.11` + хост
у змінній + `$request_uri`), інакше nginx падає на старті, якщо `api` ще не піднявся,
і кешує стару IP після його рестарту.

**`X-Frame-Options` не виставляти** — Telegram Desktop відкриває Mini App в iframe.

**Порт 8010, не 8000** — 8000 на машині користувача зайнятий portainer.

**`PYTHONDONTWRITEBYTECODE` у dev-compose** — контейнер працює від root і засівав
змонтовану робочу копію root-овими `__pycache__`, які потім не стерти без sudo.

**aiogram 3.7 неможливий** — вимагає `pydantic<2.8`, конфліктує з 2.9.2 в API. Взято 3.31.

**`.dockerignore` обов'язковий** — контекст збірки nginx це корінь проєкту, тож без нього
в daemon їде `.venv` і, головне, `.env` із секретами.

---

## 9. Команди

```bash
# запуск
docker compose -f docker-compose.dev.yml up --build      # redis + api + bot
docker compose -f docker-compose.dev.yml --profile frontend up   # + Vite (після скафолдингу)

# тестування захищених ендпоінтів
export BOT_TOKEN=$(grep '^BOT_TOKEN=' .env | cut -d= -f2-)
export INIT_DATA=$(python3 scripts/generate_test_init_data.py "$BOT_TOKEN" | tail -2 | head -1)
curl -s -H "X-Telegram-Init-Data: $INIT_DATA" localhost:8010/api/me | jq
# або Swagger: localhost:8010/docs → Authorize

# перевірки (те саме ганяє CI)
ruff check api bot
python -m compileall -q api/src bot/src
docker compose -f docker-compose.dev.yml config -q
```

Тестовий користувач у скрипті — `telegram_id=111111111`.
`initData` дійсний 24 години.

---

## 10. Наступні кроки

1. **Скафолдинг фронтенду** — блокер: node/npm у системі не встановлені.
   Варіанти: поставити Node локально або дописати `frontend/Dockerfile.dev`
   (сервіс у compose уже підготовлений за профілем `frontend`).
2. **Каркас Vite + React + TS**, `@telegram-apps/sdk` у mock-режимі для розробки в браузері.
3. **Екрани по черзі:** Онбординг (реєстрація) → Категорії → Товари → Картка товару
   (вибір розміру + степер) → Кошик → Контакти.
4. **Додати nginx у матрицю збірки CI** — зараз його стадія build потребує
   `frontend/package.json`, якого ще немає.
5. **Оновити `MINI_APP_URL`** — зараз плейсхолдер `example.ngrok-free.app`,
   на нього ж указує Menu Button бота.

**Відкладено користувачем:** pytest-набір з httpx (CI зараз перевіряє лише лінт,
імпорт і збірку — жодної поведінки), `.http`-файл для VS Code REST Client.
