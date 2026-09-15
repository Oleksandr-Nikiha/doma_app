-- 0005_managers_and_roles.sql
-- Таблиця менеджерів та ролей для адмін-панелі

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

-- Автоматично призначаємо першого зареєстрованого користувача головним адміністратором,
-- щоб одразу мати доступ до адмін-панелі
INSERT INTO managers (telegram_id, role, location_id, is_active)
SELECT telegram_id, 'admin', NULL, true
FROM users
ORDER BY id ASC
LIMIT 1
ON CONFLICT (telegram_id) DO NOTHING;

