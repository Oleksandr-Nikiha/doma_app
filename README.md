# Doma Mini App

**Telegram Mini App для замовлення їжі** з двох закладів у Вишгороді — Doma Pizza та Doma Croissants.
Каталог, кошик і профіль живуть у веб-застосунку всередині Telegram; бот лишається точкою входу
та каналом нотифікацій.

[![CI](https://github.com/Oleksandr-Nikiha/doma_app/actions/workflows/ci.yml/badge.svg)](https://github.com/Oleksandr-Nikiha/doma_app/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![aiogram](https://img.shields.io/badge/aiogram-3.31-2CA5E0.svg?logo=telegram&logoColor=white)](https://aiogram.dev/)

> **Статус: Фази 1–3 та Фаза 5 реалізовані.** Бекенд, бот, інфраструктура, каталог обох закладів
> (Doma Pizza та Doma Croissants), мультилокаційний кошик, чекаут (доставка/самовивіз зі збереженими адресами),
> історія замовлень із повтором у клік, інтерактивне керування замовленнями у боті, верифікація номера телефону,
> розширена адмін-панель із бізнес-аналітикою та маркетинговими розсилками, а також Redis-кешування і Rate Limiting готові.
> Далі — онлайн-оплата (Фаза 4), див. [Roadmap](#roadmap).

---

## Можливості

**Готово:**

- **Реєстрація та профіль клієнта:**
  - Вхід без окремого логіна — особа встановлюється з підписаного Telegram `initData`
  - Перегляд картки клієнта (код `DM-{telegram_id}`, баланс бонусів)
  - Редагування імені, прізвища, основної та додаткової адреси доставки (`/profile`)
  - Верифікація номера телефону через кнопку «Поділитися контактом» у боті з захистом від несанкціонованої зміни
- **Каталог:**
  - Дворівневі категорії обох закладів (Doma Pizza та Doma Croissants)
  - Товари, розкладені по секціях із липкими заголовками
  - Картка товару з вибором розміру, варіантів цін і ваги
  - Опції «на вибір» з безкоштовною квотою (`free_count`): соуси, напої тощо
  - Стоп-лист (`is_available`): товар або окремий розмір ховається без порушення цілісності БД
- **Кошик:**
  - Додавання з перевіркою мінімальних/максимальних лімітів опцій на сервері
  - Зміна кількості з атомарною ревалідацією опцій (`FOR UPDATE`), видалення, повне очищення
  - Мультилокаційний кошик: групування позицій за закладом із підказкою про роздільне оформлення
- **Оформлення замовлення (Checkout):**
  - Вибір типу отримання: 🛵 доставка кур'єром за адресою або 🛍️ самовивіз із закладу
  - Довідник адрес доставки Вишгорода з підтримкою стоп-листа та автокомплітом
  - Вибір запланованого часу (scheduled time) з урахуванням робочих годин закладу (мінімум +30 хв)
  - Вибір способу оплати: 💵 готівка або 💳 картка
  - Коментар до замовлення, автозаповнення контактних даних з профілю
  - Окреме оформлення страв для кожного закладу в один клік
  - Екран успішного замовлення з деталями
- **Історія замовлень (Фаза 3):**
  - Перегляд списку минулих замовлень користувача (`/orders`)
  - Деталі замовлення: склад, статус приготування/доставки, фінальна ціна
  - Повтор будь-якого минулого замовлення в кошик в один клік
- **Керування замовленнями через Telegram-бота:**
  - Миттєве надсилання картки нового замовлення персоналу в чат
  - Інтерактивні інлайн-кнопки перемикання статусів (в процесі, готово, виконано, скасовано)
  - Кнопки швидкого коригування часу доставки (+15, +30, +45, +1 год, якнайшвидше)
  - Автоматичне сповіщення клієнта у боті про зміну статусу та оновлення часу
  - RBAC-контроль доступу менеджера безпосередньо через таблицю `managers` у БД
- **Адмін-панель (`/admin`):**
  - Авторизація персоналу через Telegram-бота з одноразовими кодами
  - Керування ролями та персоналом закладів
  - Перегляд та модерація замовлень зі зміною статусів
  - Керування базою користувачів (блокування, нотатки, статус верифікації телефону)
  - Керування адресним довідником та стоп-листом вулиць
  - Очищення кешу каталогу в один клік
- **Бізнес-аналітика та маркетингові розсилки (Фаза 5):**
  - Дашборд показників: виторг, середній чек, динаміка замовлень за періодами
  - Фільтрація аналітики за закладами, способами доставки та типами оплати
  - Топ найпопулярніших страв за кількістю замовлень та сумою
  - Таргетовані розсилки через Telegram-бота з веб-адмінки
  - Гнучка сегментація аудиторії (всі, активні за 30 днів, сплячі >30 днів, топ-замовники від 5 замовлень)
  - Telegram Live Preview тексту повідомлення з підтримкою форматування та безпечна відправка з дотриманням рейт-лімітів
- **Продуктивність та захист (Redis):**
  - Кешування публічних даних (категорії, товари, локації) із настроюваним TTL
  - Миттєва автоматична інвалідація кешу при модифікації меню в адмінці
  - Підтримка обходу кешу (`?bypass_cache=true`, `X-Bypass-Cache: true`)
  - Rate Limiting на базі Redis для захисту публічних ендпоінтів від спаму
- **Контакти:**
  - Інформація про заклади (адреси, контактні номери)
- **Бот:**
  - `/start` із кнопкою запуску Mini App та постійна Menu Button зліва від поля вводу
  - Верифікація контактного номера через відправку контакту

**Екрани Mini App:** онбординг, категорії, список товарів із секціями, картка товару,
кошик із розділенням закладу, чекаут, екран успішного замовлення, історія замовлень, профіль клієнта,
адмін-панель (замовлення, клієнти, персонал, адреси, аналітика, розсилки), контакти.
Нативна кнопка «Назад», тактильний відгук (Haptic), підтримка світлої й темної тем Telegram.

**Заплановано:** Telegram Payments (Фаза 4) — див. [Development.md](Development.md).

---

## Архітектура

```text
Telegram client
      │
      ├── Bot (aiogram)  ──── polling ────► Telegram Bot API
      │      └── /start, Menu Button, надалі нотифікації
      │
      └── Mini App (WebView)
             │  HTTPS, заголовок X-Telegram-Init-Data
             ▼
          nginx ──── /        ─► статика React (SPA)
            │   └─── /api/    ─► FastAPI
            │                      │
            ▼                      ▼
          Redis                PostgreSQL
```

Окремої авторизації немає: кожен запит несе `initData`, бекенд перевіряє HMAC-підпис
на `BOT_TOKEN` і дістає з нього `telegram_id`.

### Стек

 Шар | Технології
--- | ---
 API | FastAPI, Pydantic v2, asyncpg
 Бот | aiogram 3
 Фронтенд | React 19 + TypeScript + Vite 8, TailwindCSS 4, TanStack Query, `@telegram-apps/sdk-react`
 Сховище | PostgreSQL, Redis
 Інфраструктура | Docker Compose, nginx

---

## Структура

```text
api/        FastAPI — REST для Mini App (валідація initData, каталог, кошик, адмінка, кешування)
bot/        aiogram — точка входу /start, нотифікації, модерація замовлень, розсилки
frontend/   React + TS + Vite — сам Mini App
db/         SQL-міграції та початковий сид каталогу обох закладів
nginx/      Прод-образ: збірка фронтенду + віддача статики + проксі /api
scripts/    Локальні dev-утиліти (не відстежуються в git)
```

---

## Швидкий старт

### Передумови

- Docker і Docker Compose
- PostgreSQL (зовнішній — у compose не піднімається)
- Бот, створений у [@BotFather](https://t.me/BotFather), і його токен
- HTTPS-URL для Mini App — локально зручно через [ngrok](https://ngrok.com/)
  або Cloudflare Tunnel (BotFather не приймає `http://`)

### Налаштування

```bash
git clone https://github.com/Oleksandr-Nikiha/doma_app.git
cd doma_app

cp .env.example .env
$EDITOR .env          # DATABASE_URL, BOT_TOKEN, MINI_APP_URL
```

Застосувати схему й тестові дані:

```bash
# Застосувати всі міграції (db/migrations/):
for f in $(ls db/migrations/*.sql | sort); do psql "$DATABASE_URL" -f "$f"; done

# Наповнити початковий каталог (Doma Pizza та Doma Croissants):
psql "$DATABASE_URL" -f db/seed/seed_catalog.sql
```

### Запуск

```bash
docker compose -f docker-compose.dev.yml up --build
```

Підіймаються `redis`, `api`, `bot` і `frontend`.
API — на `http://localhost:8010` (Swagger на `/docs`), Mini App — на `http://localhost:5173`.

> Порт на хості — **8010**, а не 8000: 8000 часто зайнятий (у автора — portainer).
> Змінюється в `docker-compose.dev.yml` і `VITE_API_BASE_URL`.

`frontend/node_modules` лежить на хості (а не в анонімному томі) — інакше
IDE не бачить типів. Після зміни `package.json` достатньо перезапустити сервіс:

```bash
docker compose -f docker-compose.dev.yml restart frontend
```

### Змінні оточення

Змінна | Обов'язкова | Опис
--- | --- | ---
`DATABASE_URL` | так | DSN PostgreSQL, напр. `postgresql://user:pass@host:5432/doma_app_db`
`BOT_TOKEN` | так | Токен від BotFather; ним же валідується `initData`
`MINI_APP_URL` | так | HTTPS-URL Mini App для кнопки в боті
`MANAGER_CHAT_ID` | ні | ID чату/групи менеджерів у Telegram для отримання карток нових замовлень та модерації
`REDIS_URL` | ні | URL підключення до Redis (типово `redis://redis:6379/0`)
`CATALOG_CACHE_ENABLED` | ні | Увімкнення кешування каталогу в Redis (типово `true`)
`CATALOG_CACHE_TTL` | ні | Час життя кешу публічного каталогу в секундах (типово `1800` = 30 хв)
`RATE_LIMIT_ENABLED` | ні | Захист публічних ендпоінтів від спаму через Redis (типово `true`)
`RATE_LIMIT_REQUESTS` | ні | Ліміт кількості запитів у вікні (типово `120`)
`RATE_LIMIT_WINDOW_SECONDS` | ні | Вікно підрахунку запитів у секундах (типово `60`)
`CORS_ORIGINS` | ні | Origins через кому; типово Vite на `:5173`
`API_DEBUG` | ні | Типово `false`
`VITE_API_BASE_URL` | ні | Базовий URL API для фронтенду (типово `/api`)
`VITE_PUBLIC_HOST` | ні | Публічний хост/домен тунелю для `allowedHosts` у Vite dev-сервері
`VITE_DEV_INIT_DATA` | ні | Підписаний тестовий `initData` для розробки у браузері поза Telegram

---

## API

Метод | Шлях | Auth | Опис
--- | --- | :---: | ---
GET | `/api/health` | — | healthcheck (без звернення до БД)
POST | `/api/register` | ✓ | створити/оновити профіль
GET | `/api/me` | ✓ | профіль поточного користувача
PATCH | `/api/me` | ✓ | оновити ім'я, прізвище, основну та додаткову адреси
GET | `/api/categories` | — | дерево категорій обох закладів (кешується, обхід: `?bypass_cache=true`)
GET | `/api/categories/{id}/products` | — | товари категорії **та її підкатегорій** (кешується)
GET | `/api/products/{id}` | — | картка товару: варіанти + групи опцій (кешується)
GET | `/api/cart` | ✓ | вміст кошика
POST | `/api/cart/items` | ✓ | додати позицію
PATCH | `/api/cart/items/{id}` | ✓ | змінити кількість (з ревалідацією опцій)
DELETE | `/api/cart/items/{id}` | ✓ | видалити позицію
DELETE | `/api/cart` | ✓ | очистити кошик
POST | `/api/orders` | ✓ | створити замовлення з кошика (окремо за закладом)
GET | `/api/orders` | ✓ | список минулих замовлень поточного користувача
GET | `/api/orders/{id}` | ✓ | отримати деталі замовлення поточного користувача
POST | `/api/orders/{id}/repeat` | ✓ | повторити замовлення в кошик
GET | `/api/delivery/addresses` | — | активні адреси доставки для автокомпліту
GET | `/api/locations` | — | контакти закладів (кешується)
POST | `/api/admin/auth/request-code` | — | запит одноразового коду входу адміна у бота
POST | `/api/admin/auth/verify-code` | — | обмін коду на авторизаційну сесію
GET | `/api/admin/orders` | ✓ | список замовлень для адмінки з фільтрами
PATCH | `/api/admin/orders/{id}` | ✓ | зміна статусу та запланованого часу замовлення
GET | `/api/admin/users` | ✓ | список клієнтів із пошуком та статистикою
PATCH | `/api/admin/users/{id}` | ✓ | блокування, нотатка або статус верифікації телефону
GET/POST/PATCH/DELETE | `/api/admin/delivery/addresses` | ✓ | керування довідником адрес доставки
POST | `/api/admin/catalog/cache/clear` | ✓ | примусове очищення кешу каталогу персоналом
GET | `/api/admin/analytics/overview` | ✓ | аналітика виторгу, замовлень та середнього чека
GET | `/api/admin/analytics/top-products` | ✓ | топ страв за замовленнями та доходами
GET | `/api/admin/broadcasts/audiences` | ✓ | сегменти аудиторії клієнтів для розсилки
POST | `/api/admin/broadcasts/send` | ✓ | відправка маркетингової розсилки через бота

Позначені ✓ потребують заголовка `X-Telegram-Init-Data`; без нього або
з невалідним підписом — `401`. Публічні GET-запити каталогу підтримують заголовок
`X-Bypass-Cache: true` або query-параметр `?bypass_cache=true` для отримання даних напряму з БД.

### Тестування API без Telegram

Згенерувати валідний підписаний `initData`:

```bash
python3 scripts/generate_test_init_data.py "$BOT_TOKEN"
```

Рядок діє **24 години**. Коли протухне, фронтенд почне отримувати `401` —
оновити разом із перезапуском контейнера можна одною командою:

```bash
./scripts/refresh_dev_init_data.sh
```

Далі є два шляхи.

**Swagger.** Відкрити `http://localhost:8010/docs` → **Authorize** → вставити рядок.
Він застосується до всіх захищених ендпоінтів одразу.

**curl.** Зручно покласти рядок у змінну — він дійсний 24 години:

```bash
export INIT_DATA=$(python3 scripts/generate_test_init_data.py "$BOT_TOKEN" | tail -2 | head -1)

curl -s -H "X-Telegram-Init-Data: $INIT_DATA" localhost:8010/api/me | jq

curl -s -X POST localhost:8010/api/cart/items \
  -H "X-Telegram-Init-Data: $INIT_DATA" -H 'Content-Type: application/json' \
  -d '{"variant_id":1,"qty":2,"options":[]}' | jq
```

Товар із обовʼязковими опціями без них не додасться — бекенд віддасть `400`
і напише, якої групи бракує:

```bash
curl -s -X POST localhost:8010/api/cart/items \
  -H "X-Telegram-Init-Data: $INIT_DATA" -H 'Content-Type: application/json' \
  -d '{"variant_id":162,"qty":1,"options":[{"group_id":2,"variant_id":194},
                                           {"group_id":3,"variant_id":180}]}' | jq
```

Тестовий користувач — `telegram_id=111111111`, зашитий у самому скрипті.
Підставте туди свій справжній id, якщо хочете бачити себе в БД після `/register`.

Без заголовка або з невалідним підписом захищені ендпоінти віддають `401`.

### Перевірки

Те саме, що ганяє CI:

```bash
ruff check api bot                                    # лінт (конфіг — ruff.toml)
python -m compileall -q api/src bot/src
docker compose -f docker-compose.dev.yml config -q    # валідність compose
docker run --rm -v "$PWD/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine nginx -t                          # синтаксис nginx
```

Фронтенд:

```bash
cd frontend && npm ci && npx tsc --noEmit && npx vite build
```

CI додатково збирає образи `api`, `bot` і `nginx` (останній разом із фронтендом)
та перевіряє, що в репозиторій не потрапив `.env`, схожий на справжній `BOT_TOKEN`
чи підписаний `initData`.

---

## Деплой

```bash
docker compose up -d --build
```

Стек: `nginx` (порт 80), `api`, `bot`, `redis`. Фронтенд збирається всередині
образу nginx на етапі build.

**TLS тут не термінується** — Telegram вимагає HTTPS, тож перед nginx має стояти
зовнішній reverse-proxy, certbot або тунель. Приклад HTTPS-блоку закоментований
у [nginx/nginx.conf](nginx/nginx.conf).

### Публікація для Telegram

Telegram відкриває Mini App лише за HTTPS-URL. Потрібні домен і сертифікат;
далі reverse-proxy на хості віддає застосунок і API з одного origin:

```nginx
location /api/ { proxy_pass http://127.0.0.1:8010; }   # API
location /     { root /var/www/doma-app; try_files $uri $uri/ /index.html; }
```

Статику можна зібрати локально (`npm --prefix frontend run build`) і розкласти
у директорію веб-сервера (наприклад, `/var/www/doma-app`).

**Dev-сервер Vite назовні виставляти не можна.** Він віддає вихідні тексти
з уже підставленими значеннями `VITE_*`-змінних, а серед них `VITE_DEV_INIT_DATA` —
підписаний `initData`, тобто валідні облікові дані до захищеного API.
Тому в dev-compose порт прив'язаний до `127.0.0.1`.

`X-Frame-Options` не виставляти: Telegram Desktop відкриває Mini App в iframe.

У `.env` вказати `MINI_APP_URL`, `VITE_PUBLIC_HOST` (домен потрібен Vite
для `allowedHosts`) і додати домен у `CORS_ORIGINS`. Після зміни `MINI_APP_URL`
перестворити контейнер бота — він виставляє Menu Button на старті:

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate bot
```

---

## Roadmap

Фаза | Обсяг | Стан
--- | --- | ---
1 | MVP: реєстрація, каталог, кошик, контакти | ✅ готово
2 | Оформлення замовлення, фізична оплата, модерація в боті, профіль | ✅ готово
3 | Історія замовлень, повтор у клік | ✅ готово
4 | Telegram Payments (онлайн-оплата) | ⏸️ відкладено
5 | Адмін-панель, аналітика, маркетингові розсилки, Redis-кешування | ✅ готово

Деталі — у [Development.md](Development.md).

---

## Внесок

PR вітаються — див. [CONTRIBUTING.md](CONTRIBUTING.md).

## Безпека

Ніколи не комітьте `.env`: він містить `BOT_TOKEN`, яким підписується `initData`,
і креденшели БД. Файл занесений у `.gitignore` та `.dockerignore`.
Якщо токен усе ж витік — відкличте його через `/revoke` у BotFather.

## Ліцензія

[MIT](LICENSE) © 2026 Oleksandr Nikiha
