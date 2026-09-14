-- 0003_profile_fields.sql
-- 1. Додавання полів first_name, last_name, additional_address у таблицю users.
-- 2. Бекфіл first_name та last_name з існуючого full_name.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS additional_address TEXT;

-- Заповнюємо first_name та last_name для наявних користувачів, якщо вони ще порожні
UPDATE users
SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), ''), full_name),
    last_name = COALESCE(last_name, NULLIF(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''))
WHERE first_name IS NULL;
