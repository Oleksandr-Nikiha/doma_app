-- 0007_delivery_hours_and_user_notes.sql
-- 1. Оновлення стандартного часу доставки закладів на 10:30 - 21:30
ALTER TABLE locations
    ALTER COLUMN delivery_start_time SET DEFAULT '10:30',
    ALTER COLUMN delivery_end_time SET DEFAULT '21:30';

UPDATE locations
SET delivery_start_time = '10:30',
    delivery_end_time = '21:30'
WHERE delivery_start_time = '10:00' OR delivery_end_time = '22:00';

-- 2. Додавання полів блокування та примітки до таблиці users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 3. Індекс для швидкого пошуку користувачів за номером телефону
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

