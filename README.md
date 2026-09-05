# Doma Mini App

**Telegram Mini App для замовлення їжі** з двох закладів у Вишгороді — Doma Pizza та Doma Croissants.
Каталог, кошик і профіль живуть у веб-застосунку всередині Telegram; бот лишається точкою входу
та каналом нотифікацій.

[![CI](https://github.com/Oleksandr-Nikiha/doma_app/actions/workflows/ci.yml/badge.svg)](https://github.com/Oleksandr-Nikiha/doma_app/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![aiogram](https://img.shields.io/badge/aiogram-3.31-2CA5E0.svg?logo=telegram&logoColor=white)](https://aiogram.dev/)

> **Статус: MVP зібраний.** Бекенд, бот, інфраструктура і всі екрани Mini App готові.
> Далі — оформлення замовлення, див. [Roadmap](#roadmap).

---

## Можливості

**Готово:**
- Реєстрація клієнта (ім'я, телефон, адреса) без окремого логіна — особа встановлюється
  з підписаного Telegram `initData`
- Каталог: категорії обох закладів → товари → картка з варіантами розмірів і цін
- Кошик: додавання, зміна кількості, видалення позиції, повне очищення
- Контакти закладів
- Бот: `/start` із кнопкою запуску Mini App та постійна Menu Button

**Екрани Mini App:** онбординг, категорії, товари, картка товару з вибором розміру
й кількості, кошик, контакти. Нативна кнопка «Назад» і тактильний відгук Telegram.

**Заплановано:** оформлення замовлення, історія, Telegram Payments — див. [Development.md](Development.md).

---

## Архітектура

```
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

| Шар | Технології |
|---|---|
| API | FastAPI, Pydantic v2, asyncpg |
| Бот | aiogram 3 |
| Фронтенд | React 19 + TypeScript + Vite 8, TailwindCSS 4, TanStack Query, `@telegram-apps/sdk-react` |
| Сховище | PostgreSQL, Redis |
| Інфраструктура | Docker Compose, nginx |

---

## Структура

```
api/        FastAPI — REST для Mini App (валідація initData, каталог, кошик)
bot/        aiogram — точка входу /start, надалі нотифікації
frontend/   React + TS + Vite — сам Mini App
db/         SQL-міграції та сид каталогу
nginx/      Прод-образ: збірка фронтенду + віддача статики + проксі /api
scripts/    Dev-утиліти
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
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -f db/seed/seed_catalog.sql
```

### Запуск

```bash
docker compose -f docker-compose.dev.yml up --build
```

Підіймаються `redis`, `api`, `bot` і `frontend`.
API — на http://localhost:8010 (Swagger на `/docs`), Mini App — на http://localhost:5173.

> Порт на хості — **8010**, а не 8000: 8000 часто зайнятий (у автора — portainer).
> Змінюється в `docker-compose.dev.yml` і `VITE_API_BASE_URL`.

`frontend/node_modules` лежить на хості (а не в анонімному томі) — інакше
IDE не бачить типів. Після зміни `package.json` достатньо перезапустити сервіс:

```bash
docker compose -f docker-compose.dev.yml restart frontend
```

### Змінні оточення

| Змінна | Обов'язкова | Опис |
|---|---|---|
| `DATABASE_URL` | так | DSN PostgreSQL, напр. `postgresql://user:pass@host:5432/doma_app_db` |
| `BOT_TOKEN` | так | Токен від BotFather; ним же валідується `initData` |
| `MINI_APP_URL` | так | HTTPS-URL Mini App для кнопки в боті |
| `REDIS_URL` | ні | Типово `redis://redis:6379/0` |
| `CORS_ORIGINS` | ні | Origins через кому; типово Vite на `:5173` |
| `API_DEBUG` | ні | Типово `false` |
| `VITE_API_BASE_URL` | ні | Базовий URL API для фронтенду |

---

## API

| Метод | Шлях | Auth | Опис |
|---|---|:---:|---|
| GET | `/api/health` | — | healthcheck |
| POST | `/api/register` | ✓ | створити/оновити профіль |
| GET | `/api/me` | ✓ | профіль поточного користувача |
| GET | `/api/categories` | — | категорії обох закладів |
| GET | `/api/categories/{id}/products` | — | товари категорії |
| GET | `/api/products/{id}` | — | картка товару з варіантами |
| GET | `/api/cart` | ✓ | вміст кошика |
| POST | `/api/cart/items` | ✓ | додати позицію |
| PATCH | `/api/cart/items/{id}` | ✓ | змінити кількість |
| DELETE | `/api/cart/items/{id}` | ✓ | видалити позицію |
| DELETE | `/api/cart` | ✓ | очистити кошик |
| GET | `/api/locations` | — | контакти закладів |

Позначені ✓ потребують заголовка `X-Telegram-Init-Data`; без нього або
з невалідним підписом — `401`.

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

**Swagger.** Відкрити http://localhost:8010/docs → **Authorize** → вставити рядок.
Він застосується до всіх захищених ендпоінтів одразу.

**curl.** Зручно покласти рядок у змінну — він дійсний 24 години:

```bash
export INIT_DATA=$(python3 scripts/generate_test_init_data.py "$BOT_TOKEN" | tail -2 | head -1)

curl -s -H "X-Telegram-Init-Data: $INIT_DATA" localhost:8010/api/me | jq

curl -s -X POST localhost:8010/api/cart/items \
  -H "X-Telegram-Init-Data: $INIT_DATA" -H 'Content-Type: application/json' \
  -d '{"variant_id":1,"qty":2}' | jq
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

CI додатково збирає образи `api` і `bot` та перевіряє, що в репозиторій
не потрапив `.env` або схожий на справжній `BOT_TOKEN`.

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

Статику оновлює [scripts/deploy_frontend.sh](scripts/deploy_frontend.sh) — він збирає
бандл, перевіряє його на секрети й розкладає у `/var/www/doma-app`.

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

| Фаза | Обсяг | Стан |
|---|---|---|
| 1 | MVP: реєстрація, каталог, кошик, контакти | ✅ готово |
| 2 | Оформлення замовлення, фізична оплата, модерація адреси | заплановано |
| 3 | Історія замовлень, повтор у клік | заплановано |
| 4 | Telegram Payments | заплановано |
| 5 | Push-нотифікації, адмін-панель | заплановано |

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
