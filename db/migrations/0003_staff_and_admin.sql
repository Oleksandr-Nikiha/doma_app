-- 0003_staff_and_admin.sql
-- Персонал, ролі та сесії авторизації в десктопну адмін-панель.

-- 1. Менеджери та адміністратори
CREATE TABLE IF NOT EXISTS managers (
    id           SERIAL PRIMARY KEY,
    telegram_id  BIGINT NOT NULL UNIQUE REFERENCES users(telegram_id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
    location_id  INTEGER NULL REFERENCES locations(id) ON DELETE SET NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managers_telegram_id ON managers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_managers_active ON managers(telegram_id) WHERE is_active = true;

-- Гарантуємо наявність зовнішнього ключа на locations, якщо таблиця managers вже існувала
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'managers_location_id_fkey'
    ) THEN
        ALTER TABLE managers
            ADD CONSTRAINT managers_location_id_fkey
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Перший зареєстрований користувач автоматично стає адміністратором
INSERT INTO managers (telegram_id, role, location_id, is_active)
SELECT telegram_id, 'admin', NULL, true
FROM users
ORDER BY id ASC
LIMIT 1
ON CONFLICT (telegram_id) DO NOTHING;

-- 2. Сесії авторизації в адмін-панель через бота
CREATE TABLE IF NOT EXISTS admin_auth_sessions (
    id          UUID PRIMARY KEY,
    code        VARCHAR(6) NOT NULL,
    telegram_id BIGINT,
    token       TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_sessions_code ON admin_auth_sessions(code);
CREATE INDEX IF NOT EXISTS idx_admin_auth_sessions_expires ON admin_auth_sessions(expires_at);

