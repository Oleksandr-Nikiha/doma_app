-- 0017_size_presets_and_pricing_grids.sql
-- Архітектура шаблонів розмірних сіток (Size Presets / Pricing Grids):
-- 1. Створення таблиць size_presets та size_preset_items.
-- 2. Зв'язок страв (products.size_preset_id) та варіантів (product_variants.preset_item_id).
-- 3. Збережена функція синхронізації цін sync_preset_prices() для масового оновлення прайсу в 1 клік.
-- 4. Заповнення початкового шаблону "Піца Стандарт" (S=329, M=429, XL=589, 3XL=689)
--    та автоматична прив'язка існуючих піц Doma Pizza.
-- 5. Реєстрація метаданих колекцій та зв'язків у Directus CMS.

BEGIN;

-- 1. Таблиця розмірних сіток / шаблонів
CREATE TABLE IF NOT EXISTS size_presets (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,                         -- "Піца Стандарт", "Піца Преміум", "Круасани"
    location_id INTEGER NULL REFERENCES locations(id) ON DELETE SET NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_size_presets_location ON size_presets(location_id);

-- Тригер оновлення updated_at
DROP TRIGGER IF EXISTS trg_size_presets_updated_at ON size_presets;
CREATE TRIGGER trg_size_presets_updated_at
BEFORE UPDATE ON size_presets
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- 2. Елементи розмірної сітки (розміри, діаметри, дефолтні ціни)
CREATE TABLE IF NOT EXISTS size_preset_items (
    id             SERIAL PRIMARY KEY,
    preset_id      INTEGER NOT NULL REFERENCES size_presets(id) ON DELETE CASCADE,
    label          TEXT NOT NULL,                      -- "S", "M", "XL", "3XL"
    diameter       TEXT,                               -- "25 см", "32 см", "40 см", "60 см"
    default_price  NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- Базова ціна для цього розміру
    default_weight TEXT,                               -- Орієнтовна вага, напр. "500 г"
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_size_preset_items_preset_label UNIQUE (preset_id, label)
);

CREATE INDEX IF NOT EXISTS idx_size_preset_items_preset ON size_preset_items(preset_id);

-- 3. Прив'язка страв та їхніх варіантів до розмірної сітки
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS size_preset_id INTEGER NULL REFERENCES size_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_size_preset ON products(size_preset_id);

ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS preset_item_id INTEGER NULL REFERENCES size_preset_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_preset_item ON product_variants(preset_item_id);

-- 4. Функція масової синхронізації цін за розмірною сіткою
-- Оновлює ціни у всіх product_variants, прив'язаних до розмірів даного шаблону.
CREATE OR REPLACE FUNCTION sync_preset_prices(p_preset_id INT)
RETURNS INT AS $$
DECLARE
    v_updated_count INT;
BEGIN
    UPDATE product_variants pv
    SET price = spi.default_price
    FROM size_preset_items spi
    WHERE pv.preset_item_id = spi.id
      AND spi.preset_id = p_preset_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Автоматичний тригер: зміна ціни в розмірній сітці автоматично оновлює всі прив'язані піци
CREATE OR REPLACE FUNCTION trg_sync_preset_item_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.default_price IS DISTINCT FROM OLD.default_price THEN
        UPDATE product_variants
        SET price = NEW.default_price
        WHERE preset_item_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_size_preset_items_price_sync ON size_preset_items;
CREATE TRIGGER trg_size_preset_items_price_sync
AFTER UPDATE OF default_price ON size_preset_items
FOR EACH ROW
EXECUTE FUNCTION trg_sync_preset_item_price();

-- 5. Початкове наповнення (Seed): Шаблон "Піца Стандарт"
DO $$
DECLARE
    v_preset_id INT;
    v_pizza_loc_id INT;
BEGIN
    SELECT id INTO v_pizza_loc_id FROM locations WHERE name ILIKE '%Pizza%' LIMIT 1;
    IF v_pizza_loc_id IS NULL THEN
        SELECT id INTO v_pizza_loc_id FROM locations ORDER BY id ASC LIMIT 1;
    END IF;

    -- Створюємо шаблон, якщо ще немає
    INSERT INTO size_presets (name, location_id, sort_order)
    VALUES ('Піца Стандарт', v_pizza_loc_id, 10)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_preset_id FROM size_presets WHERE name = 'Піца Стандарт' LIMIT 1;

    IF v_preset_id IS NOT NULL THEN
        -- Створюємо розміри: S, M, XL, 3XL
        INSERT INTO size_preset_items (preset_id, label, diameter, default_price, default_weight, sort_order)
        VALUES
            (v_preset_id, 'S',   '25 см', 329.00, '500 г',  10),
            (v_preset_id, 'M',   '32 см', 429.00, '750 г',  20),
            (v_preset_id, 'XL',  '40 см', 589.00, '1400 г', 30),
            (v_preset_id, '3XL', '60 см', 689.00, '1950 г', 40)
        ON CONFLICT (preset_id, label) DO UPDATE SET
            diameter = EXCLUDED.diameter,
            default_price = EXCLUDED.default_price,
            default_weight = EXCLUDED.default_weight,
            sort_order = EXCLUDED.sort_order;

        -- Прив'язуємо існуючі піци до цього пресету
        -- (страви, які мають хоча б два варіанти серед 'S', 'M', 'XL', '3XL')
        UPDATE products
        SET size_preset_id = v_preset_id
        WHERE id IN (
            SELECT p.id
            FROM products p
            JOIN product_variants pv ON pv.product_id = p.id
            WHERE pv.label IN ('S', 'M', 'XL', '3XL')
            GROUP BY p.id
            HAVING count(pv.id) >= 2
        )
        AND size_preset_id IS NULL;

        -- Проставляємо preset_item_id у відповідні варіанти піц
        UPDATE product_variants pv
        SET preset_item_id = spi.id
        FROM products p, size_preset_items spi
        WHERE pv.product_id = p.id
          AND p.size_preset_id = v_preset_id
          AND spi.preset_id = v_preset_id
          AND pv.label = spi.label
          AND pv.preset_item_id IS NULL;
    END IF;
END $$;

-- 6. Права доступу на нові таблиці та послідовності для сервісного користувача
GRANT USAGE, SELECT ON SEQUENCE size_presets_id_seq TO svc_doma_app;
GRANT USAGE, SELECT ON SEQUENCE size_preset_items_id_seq TO svc_doma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON size_presets TO svc_doma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON size_preset_items TO svc_doma_app;

-- 7. Реєстрація метаданих у Directus CMS (якщо встановлено Directus)
INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, sort)
VALUES
    ('size_presets', 'straighten', 'Шаблони розмірних сіток та цін (Піци, Бургери тощо)', '{{name}}', false, false, 5),
    ('size_preset_items', 'format_size', 'Розміри та ціни в шаблоні', '{{label}} ({{diameter}}) - {{default_price}} грн', false, false, 6)
ON CONFLICT (collection) DO UPDATE SET
    icon = EXCLUDED.icon,
    note = EXCLUDED.note,
    display_template = EXCLUDED.display_template,
    hidden = EXCLUDED.hidden,
    sort = EXCLUDED.sort;

-- Інтерфейси полів
DO $$
DECLARE
    rec RECORD;
    fields_data JSONB := '[
        {"collection": "size_presets", "field": "name", "interface": "input", "display": "raw", "sort": 1, "width": "half", "note": "Назва розмірної сітки (напр. Піца Стандарт)", "required": true},
        {"collection": "size_presets", "field": "location_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 2, "width": "half", "note": "Заклад (необов''язково)", "required": false},
        {"collection": "size_presets", "field": "sort_order", "interface": "input", "sort": 3, "width": "half", "note": "Порядок відображення", "required": false},

        {"collection": "size_preset_items", "field": "preset_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 1, "width": "half", "note": "Шаблон сітки", "required": true},
        {"collection": "size_preset_items", "field": "label", "interface": "input", "display": "raw", "sort": 2, "width": "half", "note": "Позначення (S, M, XL, 3XL)", "required": true},
        {"collection": "size_preset_items", "field": "diameter", "interface": "input", "display": "raw", "sort": 3, "width": "half", "note": "Діаметр (напр. 25 см)", "required": false},
        {"collection": "size_preset_items", "field": "default_price", "interface": "input", "display": "formatted-value", "sort": 4, "width": "half", "note": "Базова ціна розміру (грн)", "required": true},
        {"collection": "size_preset_items", "field": "default_weight", "interface": "input", "sort": 5, "width": "half", "note": "Орієнтовна вага", "required": false},
        {"collection": "size_preset_items", "field": "sort_order", "interface": "input", "sort": 6, "width": "half", "note": "Порядок розміру", "required": false},

        {"collection": "products", "field": "size_preset_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 4, "width": "half", "note": "Розмірна сітка страви", "required": false}
    ]';
BEGIN
    FOR rec IN SELECT * FROM jsonb_to_recordset(fields_data) AS x(
        collection text, field text, special text, interface text, display text,
        sort int, width text, note text, required boolean
    )
    LOOP
        IF EXISTS (SELECT 1 FROM directus_fields WHERE collection = rec.collection AND field = rec.field) THEN
            UPDATE directus_fields
            SET
                special = COALESCE(rec.special, directus_fields.special),
                interface = COALESCE(rec.interface, directus_fields.interface),
                display = COALESCE(rec.display, directus_fields.display),
                sort = COALESCE(rec.sort, directus_fields.sort),
                width = COALESCE(rec.width, directus_fields.width),
                note = COALESCE(rec.note, directus_fields.note),
                required = COALESCE(rec.required, directus_fields.required)
            WHERE collection = rec.collection AND field = rec.field;
        ELSE
            INSERT INTO directus_fields (
                collection, field, special, interface, display, sort, width, note, required
            )
            VALUES (
                rec.collection, rec.field, rec.special, rec.interface, rec.display,
                rec.sort, rec.width, rec.note, COALESCE(rec.required, false)
            );
        END IF;
    END LOOP;
END $$;

-- Реєстрація зв'язків у directus_relations
INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'size_presets', 'location_id', 'locations', 'size_presets', 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'size_presets' AND many_field = 'location_id'
);

INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'size_preset_items', 'preset_id', 'size_presets', 'items', 'cascade'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'size_preset_items' AND many_field = 'preset_id'
);

INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'products', 'size_preset_id', 'size_presets', 'products', 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'products' AND many_field = 'size_preset_id'
);

-- Публічні права читання Directus
DO $$
DECLARE
    pub_policy UUID;
BEGIN
    SELECT id INTO pub_policy FROM directus_policies WHERE name = '$t:public_label' LIMIT 1;
    IF pub_policy IS NOT NULL THEN
        INSERT INTO directus_permissions (policy, collection, action, permissions, validation, fields)
        SELECT pub_policy, c, 'read', '{}', '{}', '*'
        FROM unnest(ARRAY['size_presets', 'size_preset_items']) AS c
        WHERE NOT EXISTS (
            SELECT 1 FROM directus_permissions WHERE policy = pub_policy AND collection = c AND action = 'read'
        );
    END IF;
END $$;

COMMIT;
