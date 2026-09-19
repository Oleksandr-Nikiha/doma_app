-- 0006_broadcasts.sql
-- Таблиця маркетингових розсилок через Telegram-бота з сегментацією

CREATE TABLE IF NOT EXISTS broadcasts (
    id                SERIAL PRIMARY KEY,
    author_id         BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE RESTRICT,
    title             TEXT NOT NULL,
    text              TEXT NOT NULL,
    image_url         TEXT,
    button_text       TEXT,
    button_url        TEXT,
    segment           TEXT NOT NULL CHECK (segment IN ('all', 'active_30d', 'inactive', 'top_orders')),
    status            TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'completed', 'failed')),
    total_recipients  INTEGER NOT NULL DEFAULT 0,
    sent_count        INTEGER NOT NULL DEFAULT 0,
    failed_count      INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);