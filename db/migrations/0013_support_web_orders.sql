-- 0013_support_web_orders.sql
-- Дозволяємо збереження замовлень з публічних веб-сайтів закладів
-- (telegram_id стає необов'язковим, додається колонка джерела замовлення source)

ALTER TABLE orders ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'telegram';

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

