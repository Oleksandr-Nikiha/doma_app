-- 0012_options_surrogate_keys.sql
-- Додавання surrogate primary key (id SERIAL PRIMARY KEY) до таблиць:
--  1. product_option_groups
--  2. option_group_items
-- Це дозволяє Directus CMS керувати даними колекціями без помилок "doesn't have a primary key column".
-- Унікальні складені обмеження (UNIQUE) та зовнішні ключі (FOREIGN KEY) повністю зберігаються.

BEGIN;

-- 1. Таблиця product_option_groups
ALTER TABLE product_option_groups ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE product_option_groups DROP CONSTRAINT IF EXISTS product_option_groups_pkey;
ALTER TABLE product_option_groups ADD CONSTRAINT product_option_groups_pkey PRIMARY KEY (id);
ALTER TABLE product_option_groups ADD CONSTRAINT uq_product_option_groups_product_group UNIQUE (product_id, group_id);

-- 2. Таблиця option_group_items
-- Примітка: cart_item_options посилається на (group_id, variant_id), тому спочатку тимчасово
-- знімаємо зовнішній ключ, оновлюємо PK та додаємо UNIQUE на (group_id, variant_id),
-- після чого відновлюємо FK.
ALTER TABLE option_group_items ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE cart_item_options DROP CONSTRAINT IF EXISTS cart_item_options_group_id_variant_id_fkey;
ALTER TABLE option_group_items DROP CONSTRAINT IF EXISTS option_group_items_pkey;
ALTER TABLE option_group_items ADD CONSTRAINT option_group_items_pkey PRIMARY KEY (id);
ALTER TABLE option_group_items ADD CONSTRAINT uq_option_group_items_group_variant UNIQUE (group_id, variant_id);
ALTER TABLE cart_item_options ADD CONSTRAINT cart_item_options_group_id_variant_id_fkey
    FOREIGN KEY (group_id, variant_id) REFERENCES option_group_items(group_id, variant_id) ON DELETE CASCADE;

-- Надаємо права користувачу сервісу на послідовності (sequences)
GRANT USAGE, SELECT ON SEQUENCE product_option_groups_id_seq TO svc_doma_app;
GRANT USAGE, SELECT ON SEQUENCE option_group_items_id_seq TO svc_doma_app;

-- 3. Реєстрація метаданих колекцій у Directus (directus_collections)
INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, sort)
VALUES
    ('product_option_groups', 'settings_suggest', 'Групи модифікаторів для страв', '{{product_id.name}} -> {{group_id.name}}', false, false, 41),
    ('option_group_items', 'playlist_add_check', 'Позиції у групах модифікаторів', '{{variant_id.label}} (+{{price_delta}} грн)', false, false, 42)
ON CONFLICT (collection) DO UPDATE SET
    icon = EXCLUDED.icon,
    note = EXCLUDED.note,
    display_template = EXCLUDED.display_template,
    hidden = EXCLUDED.hidden,
    sort = EXCLUDED.sort;

-- 4. Реєстрація інтерфейсів полів у directus_fields
DO $$
DECLARE
    rec RECORD;
    fields_data JSONB := '[
        {"collection": "product_option_groups", "field": "id", "interface": "input", "sort": 1, "width": "half", "readonly": true, "note": "ID зв''язку"},
        {"collection": "product_option_groups", "field": "product_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 2, "width": "half", "note": "Страва", "required": true},
        {"collection": "product_option_groups", "field": "group_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 3, "width": "half", "note": "Група опцій", "required": true},
        {"collection": "product_option_groups", "field": "min_select", "interface": "input", "sort": 4, "width": "half", "note": "Мінімально для вибору", "required": true},
        {"collection": "product_option_groups", "field": "max_select", "interface": "input", "sort": 5, "width": "half", "note": "Максимально для вибору", "required": true},
        {"collection": "product_option_groups", "field": "free_count", "interface": "input", "sort": 6, "width": "half", "note": "Кількість безкоштовних опцій", "required": false},
        {"collection": "product_option_groups", "field": "sort_order", "interface": "input", "sort": 7, "width": "half", "note": "Порядок відображення", "required": false},

        {"collection": "option_group_items", "field": "id", "interface": "input", "sort": 1, "width": "half", "readonly": true, "note": "ID позиції"},
        {"collection": "option_group_items", "field": "group_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 2, "width": "half", "note": "Група опцій", "required": true},
        {"collection": "option_group_items", "field": "variant_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 3, "width": "half", "note": "Варіант товару (позиція модифікатора)", "required": true},
        {"collection": "option_group_items", "field": "price_delta", "interface": "input", "sort": 4, "width": "half", "note": "Доплата до ціни (грн)", "required": true},
        {"collection": "option_group_items", "field": "sort_order", "interface": "input", "sort": 5, "width": "half", "note": "Порядок варіанту", "required": false},
        {"collection": "option_group_items", "field": "is_available", "interface": "boolean", "display": "boolean", "sort": 6, "width": "half", "note": "Доступність для замовлення", "required": false}
    ]';
BEGIN
    FOR rec IN SELECT * FROM jsonb_to_recordset(fields_data) AS x(
        collection text, field text, special text, interface text, display text,
        sort int, width text, note text, required boolean, readonly boolean
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
                required = COALESCE(rec.required, directus_fields.required),
                readonly = COALESCE(rec.readonly, directus_fields.readonly)
            WHERE collection = rec.collection AND field = rec.field;
        ELSE
            INSERT INTO directus_fields (
                collection, field, special, interface, display, sort, width, note, required, readonly
            )
            VALUES (
                rec.collection, rec.field, rec.special, rec.interface, rec.display,
                rec.sort, rec.width, rec.note, COALESCE(rec.required, false), COALESCE(rec.readonly, false)
            );
        END IF;
    END LOOP;
END $$;

COMMIT;

