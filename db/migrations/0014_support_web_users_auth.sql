-- 0014_support_web_users_auth.sql
-- Підтримка створення та авторизації користувачів без обов'язкового telegram_id
-- Додаємо поля для авторизації за телефоном/паролем/кодом

ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_code_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_phone_nonempty ON users(phone) WHERE phone <> '';

