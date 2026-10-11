-- 0011_directus_project_settings.sql
-- Налаштування Directus CMS для проєкту doma_app:
--  1. Метадані колекцій (іконки, описи, display templates, сортування)
--  2. Приховування службових таблиць (admin_auth_sessions, order_groups тощо)
--  3. Налаштування інтерфейсів полів (directus_fields)
--  4. Налаштування зв'язків (directus_relations)
--  5. Брендування Directus (directus_settings)
--  6. Додатковий парціальний індекс для швидкого опитування запланованих замовлень

-- 1. Оновлення загальних налаштувань проєкту в Directus
UPDATE directus_settings
SET
    project_name = 'Doma Delivery',
    project_descriptor = 'Керування каталогом, закладами та медіа-файлами',
    project_color = '#ea580c',
    default_language = 'uk-UA'
WHERE id = 1;

-- 2. Метадані колекцій Directus (directus_collections)
INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, sort)
VALUES
    ('products', 'restaurant_menu', 'Страви та позиції меню', '{{name}}', false, false, 1),
    ('categories', 'category', 'Категорії меню', '{{name}}', false, false, 2),
    ('product_variants', 'tune', 'Варіанти / Розміри / Ціни', '{{label}} — {{price}} грн', false, false, 3),
    ('option_groups', 'checklist', 'Групи додатків та модифікаторів', '{{name}}', false, false, 4),
    ('locations', 'storefront', 'Заклади (Doma Pizza, Doma Croissants)', '{{name}}', false, false, 5),
    ('orders', 'receipt_long', 'Замовлення клієнтів', '#{{id}} — {{total_price}} грн ({{status}})', false, false, 6),
    ('users', 'people', 'Клієнти додатку', 'DM-{{telegram_id}}: {{full_name}}', false, false, 7),
    ('delivery_addresses', 'location_on', 'Довідник адрес доставки', '{{city}}, {{street}}', false, false, 8),
    ('broadcasts', 'campaign', 'Маркетингові розсилки', '{{title}}', false, false, 9),
    ('managers', 'badge', 'Штат (адміністратори та менеджери)', '{{full_name}} ({{role}})', false, false, 10),
    ('admin_auth_sessions', NULL, 'Службові сесії QR-авторизації', NULL, true, false, 90),
    ('order_groups', NULL, 'Локаційні групи замовлень', NULL, true, false, 91),
    ('cart_items', NULL, 'Позиції покинутих/активних кошиків', NULL, true, false, 92),
    ('cart_item_options', NULL, 'Опції кошика', NULL, true, false, 93),
    ('carts', NULL, 'Кошики користувачів', NULL, true, false, 94),
    ('schema_migrations', NULL, 'Службова таблиця міграцій', NULL, true, false, 95)
ON CONFLICT (collection) DO UPDATE SET
    icon = COALESCE(EXCLUDED.icon, directus_collections.icon),
    note = EXCLUDED.note,
    display_template = EXCLUDED.display_template,
    hidden = EXCLUDED.hidden,
    sort = EXCLUDED.sort;

-- 3. Реєстрація інтерфейсів ключових полів у directus_fields

-- Оновлюємо існуючі або додаємо нові поля через DO-блок
DO $$
DECLARE
    rec RECORD;
    fields_data JSONB := '[
        {"collection": "products", "field": "name", "interface": "input", "display": "raw", "sort": 1, "width": "half", "note": "Назва страви", "required": true},
        {"collection": "products", "field": "category_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 2, "width": "half", "note": "Категорія меню", "required": true},
        {"collection": "products", "field": "description", "interface": "input-multiline", "display": "formatted-value", "sort": 3, "width": "full", "note": "Опис страви та інгредієнти", "required": false},
        {"collection": "products", "field": "sort_order", "interface": "input", "sort": 5, "width": "half", "note": "Порядок сортування", "required": false},
        {"collection": "products", "field": "is_available", "interface": "boolean", "display": "boolean", "sort": 6, "width": "half", "note": "Доступність для замовлення", "required": false},

        {"collection": "categories", "field": "name", "interface": "input", "display": "raw", "sort": 1, "width": "half", "note": "Назва категорії", "required": true},
        {"collection": "categories", "field": "location_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 2, "width": "half", "note": "Заклад", "required": true},
        {"collection": "categories", "field": "parent_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 3, "width": "half", "note": "Батьківська категорія (NULL для кореневої)", "required": false},
        {"collection": "categories", "field": "icon", "interface": "input", "sort": 4, "width": "half", "note": "Емодзі або код іконки", "required": false},
        {"collection": "categories", "field": "sort_order", "interface": "input", "sort": 5, "width": "half", "note": "Порядок відображення", "required": false},
        {"collection": "categories", "field": "is_visible", "interface": "boolean", "display": "boolean", "sort": 6, "width": "half", "note": "Видимість у клієнтському меню", "required": false},

        {"collection": "product_variants", "field": "product_id", "special": "m2o", "interface": "select-dropdown-m2o", "display": "related-values", "sort": 1, "width": "half", "note": "Страва", "required": true},
        {"collection": "product_variants", "field": "label", "interface": "input", "display": "raw", "sort": 2, "width": "half", "note": "Назва розміру/порції (напр. 30 см, Стандарт)", "required": true},
        {"collection": "product_variants", "field": "price", "interface": "input", "display": "formatted-value", "sort": 3, "width": "half", "note": "Ціна у гривнях", "required": true},
        {"collection": "product_variants", "field": "weight", "interface": "input", "sort": 4, "width": "half", "note": "Вага або об''єм (напр. 450 г)", "required": false},
        {"collection": "product_variants", "field": "sort_order", "interface": "input", "sort": 5, "width": "half", "note": "Порядок варіанту", "required": false},
        {"collection": "product_variants", "field": "is_available", "interface": "boolean", "display": "boolean", "sort": 6, "width": "half", "note": "Наявність варіанту", "required": false},

        {"collection": "locations", "field": "name", "interface": "input", "display": "raw", "sort": 1, "width": "half", "note": "Назва закладу", "required": true},
        {"collection": "locations", "field": "address", "interface": "input", "display": "raw", "sort": 2, "width": "half", "note": "Адреса закладу", "required": true},
        {"collection": "locations", "field": "is_delivery_enabled", "interface": "boolean", "display": "boolean", "sort": 3, "width": "full", "note": "Чи дозволена доставка", "required": false},
        {"collection": "locations", "field": "delivery_start_time", "interface": "input", "sort": 4, "width": "half", "note": "Початок прийому замовлень на доставку", "required": false},
        {"collection": "locations", "field": "delivery_end_time", "interface": "input", "sort": 5, "width": "half", "note": "Кінець прийому замовлень на доставку", "required": false}
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

-- 4. Реєстрація зв'язків у directus_relations
INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'categories', 'location_id', 'locations', 'categories', 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'categories' AND many_field = 'location_id'
);

INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'categories', 'parent_id', 'categories', 'subcategories', 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'categories' AND many_field = 'parent_id'
);

INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'products', 'category_id', 'categories', 'products', 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'products' AND many_field = 'category_id'
);

INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_deselect_action)
SELECT 'product_variants', 'product_id', 'products', 'variants', 'cascade'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'product_variants' AND many_field = 'product_id'
);

-- 5. Дозвіл публічного читання каталогу в Directus (якщо створено публічну політику)
DO $$
DECLARE
    pub_policy UUID;
BEGIN
    SELECT id INTO pub_policy FROM directus_policies WHERE name = '$t:public_label' LIMIT 1;
    IF pub_policy IS NOT NULL THEN
        INSERT INTO directus_permissions (policy, collection, action, permissions, validation, fields)
        SELECT pub_policy, c, 'read', '{}', '{}', '*'
        FROM unnest(ARRAY['locations', 'categories', 'products', 'product_variants', 'delivery_addresses']) AS c
        WHERE NOT EXISTS (
            SELECT 1 FROM directus_permissions WHERE policy = pub_policy AND collection = c AND action = 'read'
        );
    END IF;
END $$;

-- 6. Парціальний індекс для фонового планувальника запланованих замовлень (PERF)
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_scheduled
ON orders(scheduled_time)
WHERE status = 'confirmed' AND scheduled_time IS NOT NULL;

