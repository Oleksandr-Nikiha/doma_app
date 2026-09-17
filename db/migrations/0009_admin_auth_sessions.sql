-- Сесії авторизації в десктопну адмін-панель через Telegram-бота
CREATE TABLE IF NOT EXISTS admin_auth_sessions (
    id UUID PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    telegram_id BIGINT,
    token TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_sessions_code ON admin_auth_sessions(code);
CREATE INDEX IF NOT EXISTS idx_admin_auth_sessions_expires ON admin_auth_sessions(expires_at);

