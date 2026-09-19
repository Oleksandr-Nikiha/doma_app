-- 0005_analytics_indexes.sql
-- Індекси для аналітики замовлень та агрегації продажів за періодами

-- Швидка фільтрація замовлень за датою створення та статусом
CREATE INDEX IF NOT EXISTS idx_orders_created_at_status ON orders(created_at, status);

-- Для швидкої агрегації страв у звітах продажів
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);