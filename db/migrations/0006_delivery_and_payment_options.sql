-- 0006_delivery_and_payment_options.sql
-- Налаштування доставки для закладів (години, аварійне вимкнення при навантаженні),
-- підтримка доставки на певний час та розширення методів оплати (QR-код).

-- 1. Додавання параметрів доставки до закладів
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS is_delivery_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS delivery_start_time TIME NOT NULL DEFAULT '10:00',
    ADD COLUMN IF NOT EXISTS delivery_end_time TIME NOT NULL DEFAULT '22:00';

-- 2. Оновлення допустимих способів оплати в замовленнях (додавання 'qr')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'qr'));

-- 3. Додавання часу доставки/самовивозу в замовлення
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

