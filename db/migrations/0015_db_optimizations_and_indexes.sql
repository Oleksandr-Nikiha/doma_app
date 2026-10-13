-- 0015_db_optimizations_and_indexes.sql
-- Оптимізація бази даних: індекси для частих запитів, очищення дублікатів індексів,
-- розширення схеми кошиків для веб-користувачів та процедура регламентного обслуговування.

BEGIN;

-- 1. Індекси для пошуку та вибірки замовлень
-- Прискорює вибірку історії замовлень на сайті за номером телефону та LEFT JOIN у списку клієнтів адмінки
CREATE INDEX IF NOT EXISTS idx_orders_contact_phone_id ON orders(contact_phone, id DESC);

-- 2. Expression Index для списку активних адрес доставки
-- Забезпечує Index Scan при запитах WHERE lower(city) = lower($1) AND is_active = true ORDER BY sort_order, street
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_lower_city_active
    ON delivery_addresses(lower(city), is_active, sort_order ASC, street ASC);

-- 3. Індекси для зовнішніх ключів (Foreign Keys)
-- Запобігають Full Table Scan при JOIN та блокуванню таблиць при каскадних операціях
CREATE INDEX IF NOT EXISTS idx_managers_location_id ON managers(location_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_author_id ON broadcasts(author_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_created_at ON cart_items(created_at);

-- 4. Очищення повних дублікатів індексів
-- idx_managers_telegram_id є 100% дублікатом унікального індексу managers_telegram_id_key
DROP INDEX IF EXISTS idx_managers_telegram_id;

-- 5. Розширення схеми кошиків під веб-користувачів (без обов'язкового telegram_id)
ALTER TABLE carts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE carts ALTER COLUMN telegram_id DROP NOT NULL;

-- Заповнюємо user_id для вже існуючих кошиків
UPDATE carts c
SET user_id = u.id
FROM users u
WHERE u.telegram_id = c.telegram_id AND c.user_id IS NULL;

-- Унікальний індекс для кошика за user_id (один кошик на користувача)
CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_user_id ON carts(user_id) WHERE user_id IS NOT NULL;

-- 6. Оновлена збережена процедура регламентного очищення покинутих кошиків та застарілих сесій
CREATE OR REPLACE PROCEDURE cleanup_maintenance(days_old INT DEFAULT 14)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Видалення застарілих позицій у кошиках
    DELETE FROM cart_items
    WHERE created_at < now() - (days_old || ' days')::INTERVAL;

    -- 2. Видалення пустих покинутих кошиків
    DELETE FROM carts
    WHERE updated_at < now() - (days_old || ' days')::INTERVAL
      AND id NOT IN (SELECT DISTINCT cart_id FROM cart_items);

    -- 3. Очищення протермінованих одноразових адмін-сесій авторизації
    DELETE FROM admin_auth_sessions
    WHERE expires_at < now() - INTERVAL '1 day';
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_roles r ON p.proowner = r.oid
        WHERE p.proname = 'cleanup_abandoned_carts'
          AND r.rolname = current_user
    ) THEN
        EXECUTE $sql$
        CREATE OR REPLACE PROCEDURE cleanup_abandoned_carts(days_old INT DEFAULT 14)
        LANGUAGE plpgsql
        AS $p$
        BEGIN
            CALL cleanup_maintenance(days_old);
        END;
        $p$;
        $sql$;
    END IF;
END $$;

COMMIT;
