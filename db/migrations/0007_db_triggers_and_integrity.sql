-- 0007_db_triggers_and_integrity.sql
-- Автоматичні тригери updated_at, синхронізація статусів замовлень,
-- виправлення каскадного видалення кошиків та процедура очищення.

-- 1. Поля аудиту (created_at, updated_at) для товарів та категорій
ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Універсальна тригер-функція для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Тригери updated_at для всіх ключових таблиць
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_managers_updated_at ON managers;
CREATE TRIGGER trg_managers_updated_at
BEFORE UPDATE ON managers
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_addresses_updated_at ON delivery_addresses;
CREATE TRIGGER trg_delivery_addresses_updated_at
BEFORE UPDATE ON delivery_addresses
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


-- 3. Автоматична синхронізація статусу замовлення (orders -> order_groups)
CREATE OR REPLACE FUNCTION trg_sync_order_status_to_groups()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE order_groups
        SET status = CASE NEW.status
            WHEN 'confirmed' THEN 'accepted'
            WHEN 'in_progress' THEN 'cooking'
            WHEN 'ready' THEN 'ready'
            WHEN 'completed' THEN 'ready'
            WHEN 'rejected' THEN 'cancelled'
            WHEN 'cancelled' THEN 'cancelled'
            ELSE 'pending'
        END
        WHERE order_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_status_sync ON orders;
CREATE TRIGGER trg_orders_status_sync
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_sync_order_status_to_groups();


-- 4. Безпечне видалення страв із меню без блокування покинутими кошиками (ON DELETE CASCADE)
ALTER TABLE cart_items
    DROP CONSTRAINT IF EXISTS cart_items_variant_id_fkey;

ALTER TABLE cart_items
    ADD CONSTRAINT cart_items_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE cart_item_options
    DROP CONSTRAINT IF EXISTS cart_item_options_group_id_variant_id_fkey;

ALTER TABLE cart_item_options
    ADD CONSTRAINT cart_item_options_group_id_variant_id_fkey
    FOREIGN KEY (group_id, variant_id) REFERENCES option_group_items(group_id, variant_id) ON DELETE CASCADE;


-- 5. Збережена процедура для регламентного очищення покинутих кошиків
CREATE OR REPLACE PROCEDURE cleanup_abandoned_carts(days_old INT DEFAULT 14)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM cart_items
    WHERE created_at < now() - (days_old || ' days')::INTERVAL;
END;
$$;
