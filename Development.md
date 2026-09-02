# Doma Bot → Telegram Mini App: сценарій розробки

## Контекст

Існуючий бот `doma-bot` (aiogram 3.7, PostgreSQL/asyncpg, Redis) реалізує сервіс замовлення їжі
для двох закладів — **Doma Pizza** та **Doma Croissants** (Вишгород). Мета — перенести основний
UX замовлення у **Telegram Mini App**, залишивши бота для нотифікацій та (у майбутньому)
модерації/оплати.

Розробка ведеться ітеративно. Цей документ фіксує обсяг **MVP** та беклог наступних кроків.

---

## Поточний стан (оновлено 2026-09-02)

**Готово:**
- Backend MVP — усі 12 ендпоінтів реалізовані та перевірені наскрізно проти живої БД
- Схема БД (`0001_init.sql`) застосована, каталог засіяний
- Бот: `/start` із кнопкою Mini App + постійна Menu Button, розпізнає зареєстрованого юзера
- nginx: статика + проксі `/api`, SPA-fallback, рантайм-резолв upstream
- `docker-compose.dev.yml` (redis + api + bot) та `docker-compose.yml` (прод, з nginx)

**Лишилось для MVP:** фронтенд — жодного файлу, лише каркас директорій.

**Відхилення від початкового плану:**
- `aiogram` — **3.31**, а не 3.7: 3.7 вимагає `pydantic<2.8` і конфліктує з `pydantic 2.9.2` в API
- Порт API на хості — **8010**, а не 8000 (8000 зайнятий portainer)
- Redis у compose є, але кодом ще не використовується — кошик одразу в Postgres, як і планувалось для MVP
- Кошик **не групується** по `location_id` — свідомо, це задача Фази 2 (checkout)

---

## MVP (Фаза 1) — обсяг

MVP включає лише 4 можливості:

1. **Реєстрація клієнта** — ім'я, адреса доставки, номер телефону
2. **Вибір позицій та розмірів** із заповненням кошика
3. **Маніпуляція кошиком** — зміна кількості, видалення позиції, очищення кошика
4. **Вкладка "Контакти"**

Свідомо **поза межами MVP**:
- Оформлення замовлення (checkout) — кошик заповнюється, але кнопки "Оформити" ще немає / веде на заглушку
- Історія замовлень
- Будь-яка оплата (фізична чи віртуальна)
- Модерація адреси менеджером
- Розбиття кошика по закладах (`location_id` групування) — знадобиться вже на етапі checkout

---

## Стек технологій

**Backend (Mini App API):**
- FastAPI — окремий модуль/сервіс поруч з aiogram-ботом
- PostgreSQL (asyncpg) — те саме сховище, нові таблиці для Mini App
- Redis — кеш каталогу, тимчасове зберігання кошика (або кошик одразу в Postgres — простіше для MVP)
- Pydantic — схеми запитів/відповідей
- Валідація `Telegram.WebApp.initData` (HMAC) на кожен запит — без окремого JWT для MVP

**Frontend (Mini App UI):**
- React + TypeScript + Vite
- `@telegram-apps/sdk` (або `@twa-dev/sdk`) — тема, `MainButton`, `BackButton`, `HapticFeedback`
- `@telegram-apps/telegram-ui` — готові UI-компоненти під Telegram
- TailwindCSS
- TanStack Query — робота з API

**Інфраструктура:**
- Docker Compose: `bot`, `api`, `postgres`, `redis`, `frontend` (nginx)
- Nginx — HTTPS, роутинг `/api` → FastAPI, `/` → статика
- Cloudflare Tunnel / ngrok — для локальної розробки (BotFather вимагає HTTPS URL)

---

## Модель даних (MVP)

```
users
  id                  PK
  telegram_id         unique
  full_name
  phone
  delivery_address
  created_at

categories
  id                  PK
  name
  icon
  location_id         FK -> locations (щоб знати, з якого закладу товар)
  sort_order

products
  id                  PK
  category_id         FK
  name
  description
  image_url

product_variants
  id                  PK
  product_id          FK
  label               (S / M / XL / 3XL)
  weight
  price

locations
  id                  PK
  name                (Doma Pizza / Doma Croissants)
  address
  phone

carts
  id                  PK
  telegram_id         unique (1 активний кошик на юзера)

cart_items
  id                  PK
  cart_id             FK
  variant_id          FK
  qty
```

> Поля `fulfillment_type`, `payment_method`, `order_groups` тощо — свідомо не додаємо в MVP,
> вони з'являться разом із checkout (Фаза 2).

---

## API (MVP)

```
POST   /api/register            { full_name, phone, delivery_address }   ← створює/оновлює users
GET    /api/me                                                            ← дані профілю

GET    /api/categories
GET    /api/categories/{id}/products
GET    /api/products/{id}                                                 ← з variants

GET    /api/cart
POST   /api/cart/items           { variant_id, qty }
PATCH  /api/cart/items/{id}      { qty }
DELETE /api/cart/items/{id}
DELETE /api/cart                                                          ← очистити кошик

GET    /api/locations                                                     ← контакти
```

Кожен запит несе `initData` в заголовку (напр. `X-Telegram-Init-Data`), бекенд валідує підпис
і дістає `telegram_id` — окремої авторизації через логін/пароль немає.

---

## Екрани Mini App (MVP)

1. **Онбординг / Реєстрація**
   - Показується, якщо `users` не містить запису з цим `telegram_id`
   - Форма: Ім'я, Телефон, Адреса доставки
   - Автозаповнення імені з `Telegram.WebApp.initDataUnsafe.user.first_name` (користувач може підтвердити/змінити)
   - `MainButton`: "Зберегти" → `POST /api/register`

2. **Головна (категорії)**
   - Сітка категорій: Піца, Суші та роли, Боули та салати, Закуски, Десерти, Напої, Круасани
   - Іконка + назва (як зараз у боті, тільки у вигляді тайлів замість reply-кнопок)

3. **Список товарів категорії**
   - Картки: фото, назва, ціна "від"
   - Тап → картка товару

4. **Картка товару**
   - Фото, опис, вибір розміру (S/M/XL/3XL з ціною для кожного)
   - Степер кількості
   - `MainButton`: "Додати в кошик — {сума}"

5. **Кошик**
   - Список позицій: назва, розмір, ціна, +/– кількість, видалити позицію
   - Кнопка "Очистити кошик"
   - Підсумкова сума
   - Кнопка "Оформити" — у MVP веде на заглушку ("Скоро буде доступно") або просто прихована

6. **Контакти**
   - Статичний список закладів: назва, адреса, телефон(и) — з `GET /api/locations`

Навігація: `BackButton` Telegram SDK для повернення на попередній екран, `HapticFeedback` на дії
(додати в кошик, +/-, видалити).

---

## Кроки реалізації MVP

1. **Підготовка**
   - Реєстрація Mini App у BotFather (`/newapp`), Menu Button з `web_app`
   - Налаштування HTTPS для локальної розробки (ngrok/Cloudflare Tunnel)
   - Каркас FastAPI-сервісу поруч з існуючим ботом (спільний `docker-compose.yml`)

2. **Backend**
   - Міграції: `users`, `categories`, `products`, `product_variants`, `locations`, `carts`, `cart_items`
   - Middleware валідації `initData`
   - Ендпоінти реєстрації, каталогу, кошика, контактів
   - Наповнення каталогу тестовими даними (можна перенести з поточної логіки бота)

3. **Frontend**
   - Каркас Vite + React + TS, підключення Telegram SDK, тема (light/dark)
   - Екран реєстрації + guard (якщо не зареєстрований — редірект туди)
   - Екран категорій → товарів → картки товару
   - Екран кошика з маніпуляціями
   - Екран контактів

4. **Інтеграція та тест**
   - Наскрізний сценарій: відкрити Mini App → зареєструватися → обрати позиції → змінити кошик → очистити → перевірити контакти
   - Ручне тестування в Telegram (iOS/Android/Desktop)

5. **Деплой staging**
   - Docker Compose на сервері, Nginx + HTTPS, домен
   - Оновлення посилання в BotFather на прод-домен

---

## Беклог після MVP (Фаза 2+)

**Фаза 2 — Оформлення замовлення (фізична оплата)**
- Розбиття кошика по `location_id` закладу (мультилокаційні замовлення)
- Вибір: Самовивіз / Доставка
- Вибір способу оплати: Готівка / Картка (кур'єру або в закладі)
- Групування замовлення (`orders` + `order_groups` + `order_items`)
- Модерація адреси доставки менеджером через існуючий aiogram-бот (inline-кнопки Підтвердити/Відхилити)

**Фаза 3 — Історія замовлень**
- Екран зі списком минулих замовлень і статусами
- Повторне замовлення в один клік

**Фаза 4 — Віртуальна оплата**
- Telegram Payments: `createInvoiceLink` на бекенді, `openInvoice()` у Mini App
- Обробка `pre_checkout_query` / `successful_payment` у aiogram-хендлерах
- Автоматичне підтвердження оплачених замовлень

**Фаза 5 — Поліпшення**
- Push-нотифікації статусу замовлення через бота
- Легка адмін-панель (якщо ручна модерація в чаті стане незручною)