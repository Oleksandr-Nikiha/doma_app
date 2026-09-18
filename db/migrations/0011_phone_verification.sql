-- 0011_phone_verification.sql
-- Додавання ознаки верифікації номера телефону користувача

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_phone_verified ON users(is_phone_verified);

