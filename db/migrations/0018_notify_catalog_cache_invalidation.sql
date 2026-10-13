-- 0018_notify_catalog_cache_invalidation.sql
-- Налаштування миттєвої інвалідації Redis-кешу через PostgreSQL LISTEN / NOTIFY:
-- При будь-яких змінах у каталозі (через Directus CMS, psql або бекенд)
-- база надсилає сигнал 'catalog_cache_invalidate', за яким FastAPI очищає Redis-кеш.

BEGIN;

-- 1. Тригер-функція рівня інструкції (statement-level)
CREATE OR REPLACE FUNCTION notify_catalog_changed()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('catalog_cache_invalidate', '');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Тригери на всі таблиці, що впливають на публічний каталог
DROP TRIGGER IF EXISTS trg_notify_categories_changed ON categories;
CREATE TRIGGER trg_notify_categories_changed
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_products_changed ON products;
CREATE TRIGGER trg_notify_products_changed
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_product_variants_changed ON product_variants;
CREATE TRIGGER trg_notify_product_variants_changed
AFTER INSERT OR UPDATE OR DELETE ON product_variants
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_size_presets_changed ON size_presets;
CREATE TRIGGER trg_notify_size_presets_changed
AFTER INSERT OR UPDATE OR DELETE ON size_presets
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_size_preset_items_changed ON size_preset_items;
CREATE TRIGGER trg_notify_size_preset_items_changed
AFTER INSERT OR UPDATE OR DELETE ON size_preset_items
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_option_groups_changed ON option_groups;
CREATE TRIGGER trg_notify_option_groups_changed
AFTER INSERT OR UPDATE OR DELETE ON option_groups
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_option_group_items_changed ON option_group_items;
CREATE TRIGGER trg_notify_option_group_items_changed
AFTER INSERT OR UPDATE OR DELETE ON option_group_items
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_product_option_groups_changed ON product_option_groups;
CREATE TRIGGER trg_notify_product_option_groups_changed
AFTER INSERT OR UPDATE OR DELETE ON product_option_groups
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

DROP TRIGGER IF EXISTS trg_notify_locations_changed ON locations;
CREATE TRIGGER trg_notify_locations_changed
AFTER UPDATE OF is_delivery_enabled, delivery_start_time, delivery_end_time, phones, address, name ON locations
FOR EACH STATEMENT EXECUTE FUNCTION notify_catalog_changed();

COMMIT;
