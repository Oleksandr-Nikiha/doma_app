-- 0011_directus_project_settings.sql
-- Directus CMS видалено. Залишено лише оптимізаційний індекс для запланованих замовлень.

CREATE INDEX IF NOT EXISTS idx_orders_confirmed_scheduled
ON orders(scheduled_time)
WHERE status = 'confirmed' AND scheduled_time IS NOT NULL;
