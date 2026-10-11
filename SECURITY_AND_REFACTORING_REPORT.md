# 🛡️ Комплексний звіт: Аудит безпеки, виправлення вразливостей та рефакторинг Doma Mini App

**Дата звіту:** 11 жовтня 2026 р.  
**Проєкт:** Doma Mini App (Telegram WebApp & Delivery Platform)  
**Репозиторій:** `doma_app`  
**Гілка:** `main` (коміт `02fb5e0`)  
**Автор аналізу:** AI Coding Assistant (Pair Programming Review)

---

## 📌 Зміст
1. [Вступ та цілі аудиту](#1-вступ-та-цілі-аудиту)
2. [Архітектурна карта безпеки та потоків даних](#2-архітектурна-карта-безпеки-та-потоків-даних)
3. [Виявлені вразливості: аналіз, першопричини та наслідки](#3-виявлені-вразливості-аналіз-першопричини-та-наслідки)
4. [Детальний звіт про виконані виправлення (P0–P2)](#4-детальний-звіт-про-виконані-виправлення-p0p2)
5. [Результати автоматизованого тестування та верифікації](#5-результати-автоматизованого-тестування-та-верифікації)
6. [Чеклист та план подальших покращень (P2–P4)](#6-чеклист-та-план-подальших-покращень-p2p4)

---

## 1. Вступ та цілі аудиту

Метою аудиту було комплексне дослідження кодової бази та інфраструктури Doma Mini App з акцентом на **Безпеку застосунку (Application Security)**, зокрема:
- **Захист конфіденційних клієнтських даних (PII)**: номери телефонів, адреси доставки, персональні примітки та історія замовлень.
- **Запобігання шахрайству та махінаціям**: підміна номерів, маніпуляції з кошиком і безкоштовними опціями, фейкові замовлення на чужих людей з оплатою готівкою.
- **Стійкість до зовнішніх атак та DoS**: переповнення пам'яті (OOM), спуфінг IP-адрес для обходу Rate Limiting, блокування пулу потоків через синхронні HTTP-запити, Cache-Busting DoS.

---

## 2. Архітектурна карта безпеки та потоків даних

```mermaid
flowchart TD
    subgraph Clients["Зовнішній контур (Клієнти та Менеджери)"]
        UserTG["Клієнт (Telegram Mini App)"]
        Attacker["Зловмисник / Ботнет"]
        StaffWeb["Менеджер / Адмін (Веб-панель ПК)"]
    end

    subgraph Edge["Периметр безпеки (Caddy Reverse Proxy)"]
        Caddy["Caddy (HTTPS :443)<br/>• TLS Let's Encrypt<br/>• X-Forwarded-For: remote_host<br/>• CSP: frame-ancestors Telegram<br/>• max_size 2MB"]
    end

    subgraph AppServer["Внутрішня мережа застосунку (Docker Network)"]
        FastAPI["FastAPI API (:8000)<br/>• HMAC initData перевірка<br/>• X-Admin-Token HMAC<br/>• Rate Limiting Middleware<br/>• Pydantic le=50 валідація"]
        Redis["Redis 7<br/>• Кеш меню<br/>• Вікна Rate Limiter"]
        PG[("PostgreSQL 16<br/>• Транзакційні блокування<br/>• schema_migrations")]
        BotService["Doma Bot Service<br/>• aiogram 3 Long Polling<br/>• Верифікація телефонів"]
    end

    subgraph External["Зовнішні сервіси"]
        TGAPI["Telegram Bot API<br/>• Сповіщення чату менеджерів<br/>• Розсилки"]
    end

    UserTG -->|HTTPS + HMAC initData| Caddy
    Attacker -.->|Спроба спуфінгу / Flood| Caddy
    StaffWeb -->|HTTPS + X-Admin-Token| Caddy

    Caddy -->|/api/* (ізольована мережа)| FastAPI
    FastAPI <--> Redis
    FastAPI <-->|asyncpg pool| PG
    BotService <-->|asyncpg pool| PG
    FastAPI -.->|Асинхронний httpx пул| TGAPI
    BotService <-->|Long Polling| TGAPI
```

---

## 3. Виявлені вразливості: аналіз, першопричини та наслідки

Нижче наведено зведену матрицю виявлених вразливостей, їхній рівень загрози, першопричини та реальний вплив на систему.

| ID | Рівень | Назва вразливості | Першопричина (Root Cause) | Наслідки (Impact) |
|:---:|:---:|:---|:---|:---|
| **SEC-01** | **P0 (Критичний)** | DoS / OOM через неконтрольовану кількість `qty` | Відсутність верхньої межі `le` у моделях `CartItemIn`, `OptionSelectionIn`. Створення масивів у пам'яті множенням `[price] * qty`. | При передачі великого числа (наприклад, 2 000 000) процес Python вичерпував усю доступну оперативну пам'ять, що викликало аварійну зупинку контейнера ядра Linux (OOM Killer). |
| **SEC-02** | **P0 (Критичний)** | Блокування пулу потоків через `urllib` у Telegram API | Використання синхронного блокуючого виклику `urllib.request.urlopen` з таймаутами 5–8с всередині асинхронних обробників FastAPI. | Будь-яка затримка мережі з боку Telegram блокувала системні потоки воркерів. Сервер переставав приймати запити від користувачів. |
| **SEC-03** | **P0 (Критичний)** | Підміна верифікованого номера в `POST /api/register` | Запит `INSERT INTO users ... ON CONFLICT DO UPDATE` не перевіряв статус `is_phone_verified`. | Користувач з уже підтвердженим номером міг надіслати чужий номер, і він перезаписувався в БД, зберігаючи статус "верифікований". |
| **SEC-04** | **P0 (Критичний)** | Спуфінг IP-адреси та обхід Rate Limiting | Caddy додавав клієнтський заголовок, а Rate Limiter брав першу IP-адресу з рядка `X-Forwarded-For`. | Зловмисник міг підставляти випадковий `X-Forwarded-For` у кожному запиті, повністю нівелюючи ліміти запитів. |
| **SEC-05** | **P1 (Високий)** | Відсутність Rate Limiter на мутуючих роутах | Лімітер був підключений лише до двох ендпоінтів читання (`catalog`, `locations`). | Відкрита можливість спаму створенням замовлень, додаванням у кошик та брутфорсу сесій адмінки. |
| **SEC-06** | **P1 (Високий)** | Фейкові замовлення на чужі номери кур'єром | Сповіщення в чат менеджерів містило лише текстовий контакт без Telegram ID та без статусу верифікації. | Шахраї оформлювали пранк-замовлення на випадкові адреси з оплатою готівкою кур'єру. Заклад зазнавав прямих збитків. |
| **SEC-07** | **P1 (Високий)** | Ескалація привілеїв менеджерами закладу | Роути `create_manager`, `update_manager`, `delete_manager` використовували `Depends(get_current_staff)`. | Будь-який рядовий менеджер мав технічну можливість створювати нових співробітників або деактивувати колег. |
| **SEC-09** | **P1 (Високий)** | Cache-Busting DoS у каталозі | Прапорець `bypass_cache=true` та `X-Bypass-Cache` були відкриті для публічних клієнтів. | Ботнет міг надсилати запити з цим прапорцем, змушуючи базу даних виконувати важкі запити замість швидкого Redis-кешу. |
| **SEC-10** | **P2 (Середній)** | Ризик Clickjacking через відсутність CSP | Заголовок `X-Frame-Options` було вимкнено для Mini App, але не було задано CSP `frame-ancestors`. | Сторонні шкідливі веб-сайти могли вбудувати сторінку застосунку у прихований iframe для перехоплення дій користувача. |
| **SEC-11** | **P2 (Середній)** | Багаторазове зчитування токена адмін-сесії | Статус схваленої сесії залишався `approved` і токен зберігався в БД. | Ризик повторного перехоплення токена третьою стороною за тим самим ідентифікатором сесії. |
| **REF-16** | **P3 (Низький)** | Відсутність валідації URL у розсилках | У розсилку можна було передати посилання з довільною схемою (`javascript:`, `data:`). | Ризик фішингу або виконання шкідливого коду на стороні клієнта при відкритті посилання кнопки. |

---

## 4. Детальний звіт про виконані виправлення (P0–P2)

Всі перелічені вище вразливості **P0–P2** успішно виправлено в кодовій базі:

### 1. SEC-01: Валідація кількості товарів (`qty`)
- У схемах [`api/src/schemas/cart.py`](file:///home/alex/Development/doma_app/api/src/schemas/cart.py):
  ```python
  qty: int = Field(1, gt=0, le=50, description="Кількість (від 1 до 50)")
  ```
- У роутері [`api/src/routers/cart.py`](file:///home/alex/Development/doma_app/api/src/routers/cart.py): додано перевірку сумарної накопиченої кількості в кошику (`existing_qty + payload.qty <= 50`).

### 2. SEC-02: Асинхронний Telegram-клієнт
- Створено синглтон [`api/src/services/telegram_client.py`](file:///home/alex/Development/doma_app/api/src/services/telegram_client.py):
  - Пул з'єднань через `httpx.AsyncClient` з лімітом у 50 з'єднань та таймаутами 10с.
  - Автоматичний fallback на чистий текст у разі помилки валідації HTML.
  - Graceful закриття пулу в lifespan FastAPI.
- Вилучено всі синхронні виклики `urllib.request.urlopen` з бекенду.

### 3. SEC-03: Захист верифікованого номеру
- У [`api/src/routers/users.py`](file:///home/alex/Development/doma_app/api/src/routers/users.py):
  ```python
  if existing_user and existing_user["is_phone_verified"] and payload.phone.strip() != existing_user["phone"]:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Верифікований номер телефону не можна змінювати. Зверніться до адміністратора закладу."
      )
  ```

### 4. SEC-04 & SEC-10: Налаштування Caddy (IP Spoofing & Clickjacking)
- У [`caddy/Caddyfile`](file:///home/alex/Development/doma_app/caddy/Caddyfile):
  - Додано `header_up X-Forwarded-For {remote_host}` для гарантування автентичності IP.
  - Додано заголовок CSP: `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org;`.
- У [`api/src/middleware/rate_limiter.py`](file:///home/alex/Development/doma_app/api/src/middleware/rate_limiter.py) реалізовано зчитування довіреного останнього проксі IP.

### 5. SEC-05: Rate Limiting для мутацій
- Роутери `orders`, `cart`, `users` та `admin_auth` захищено залежністю `Depends(rate_limiter)`.

### 6. SEC-06: Сповіщення з Telegram ID та статусом верифікації
- У [`api/src/routers/orders.py`](file:///home/alex/Development/doma_app/api/src/routers/orders.py) додано:
  - Пряме посилання на Telegram-профіль замовника: `tg://user?id={tg_id}`.
  - Чітке попередження для менеджерів: `✅ Телефон верифіковано в TG` або `⚠️ НЕ ВЕРИФІКОВАНО! Перед приготуванням зателефонуйте для усного підтвердження!`.

### 7. SEC-07: Доступ до управління менеджерами
- У [`api/src/routers/admin/managers.py`](file:///home/alex/Development/doma_app/api/src/routers/admin/managers.py) ендпоінти `create_manager`, `update_manager`, `delete_manager` переведено на `Depends(get_current_admin)`.

### 8. SEC-09: Захист кешу меню
- У [`api/src/routers/catalog.py`](file:///home/alex/Development/doma_app/api/src/routers/catalog.py) параметр `bypass_cache` дозволено лише за наявності валідного `X-Admin-Token`.

### 9. SEC-11: Одноразові адмін-сесії
- У [`api/src/routers/admin_auth.py`](file:///home/alex/Development/doma_app/api/src/routers/admin_auth.py) статус сесії після першого опитування змінюється на `consumed`.

### 10. REF-16: Валідація URL кнопок розсилки
- У [`api/src/routers/admin/broadcasts.py`](file:///home/alex/Development/doma_app/api/src/routers/admin/broadcasts.py) дозволено лише схеми `https://`, `http://`, `tg://`.

---

## 5. Результати автоматизованого тестування та верифікації

### 5.1 Набір автоматичних тестів (Pytest)
Створено та розширено повний набір із **94 тестів** (`api/tests/`), які покривають усі ключові підсистеми:
- `test_phone_and_time_validation.py` (26 тестів): валідація українських телефонів (`+380...`), перевірка графіку роботи піцерій, захист від замовлень у минулому, 30-хвилинне вікно, перехід через північ.
- `test_cart.py` (15 тестів): операції кошика, ліміти кількості (`qty <= 50`), накопичувальні перевірки, обробка помилок.
- `test_options_cost.py` (11 тестів): розрахунок вартості складних страв, квоти безкоштовних соусів (`free_count`), платні модифікатори.
- `test_orders.py` (10 тестів): створення замовлень, транзакційна безпека, дедуплікація повторних натискань (20с), форматування сповіщень.
- `test_auth_and_security.py` (19 тестів): валідація HMAC-підпису Telegram WebApp `initData`, заборона підміни верифікованого телефону, безпека адмін-сесій (`consumed`), асинхронний Telegram-клієнт.
- `test_cache_and_ratelimit.py` (13 тестів): перевірка ковзних вікон Redis Rate Limiter, захист `bypass_cache`, коректна обробка заголовків `X-Forwarded-For`.

**Результат запуску тестів:**
```
============================== 94 passed in 0.38s ==============================
```

### 5.2 Повний комплекс верифікацій проєкту
1. **Ruff Linter & Style**: `All checks passed!` (0 зауважень).
2. **Compileall Python**: успішно (0 синтаксичних помилок).
3. **Frontend Production Build**: `tsc --noEmit && vite build` виконано без помилок типізації (бандл згенеровано за 362 мс).
4. **Docker Compose Validation**: конфігурація `docker-compose.yml` валідна.
5. **Git Tree**: всі зміни закомічено (`02fb5e0`) та успішно надіслано в репозиторій.

---

## 6. Чеклист та план подальших покращень (P2–P4)

Решта завдань з беклогу технічного боргу та некритичних оптимізацій зафіксована у файлі `RECOMMENDATIONS.md`:
- **SEC-08 (P1)**: Нормалізація `options_key` на одиницю товару (`qty // item_qty`) для запобігання дублюванню позицій кошика.
- **SEC-12 (P2)**: Обмеження повного списку клієнтів у `admin/users.py` роллю `admin` (менеджери бачать лише клієнтів свого закладу).
- **REF-13 (P2)**: Виділення сервісного шару `OrderService` та `OrderNotifier` для декомпозиції монолітного `routers/orders.py`.
- **REF-14 (P2)**: Додавання умови `WHERE product_id = ANY($1)` у вибірці страв адмінки для усунення N+1 запитів до БД.
- **REF-15 (P3)**: Встановлення обмежень пам'яті та CPU (`deploy.resources.limits`) у `docker-compose.yml`.
- **REF-17 (P3)**: Декомпозиція форми `CheckoutPage.tsx` на менші React-компоненти.
