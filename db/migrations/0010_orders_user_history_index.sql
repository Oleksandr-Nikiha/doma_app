-- 0010_orders_user_history_index.sql
-- Композитний індекс для прискорення запитів історії замовлень клієнта (telegram_id, id DESC)

CREATE INDEX IF NOT EXISTS idx_orders_telegram_id_id_desc ON orders(telegram_id, id DESC);

