-- seed_catalog.sql
-- Тестові дані для локальної розробки (на основі реального каталогу doma-bot)

INSERT INTO locations (name, address, phones) VALUES
    ('Doma Pizza', 'Вишгород, вул. Набережна, 8Д', ARRAY['+380671127733', '+380631127733']),
    ('Doma Croissants', 'Вишгород, просп. Шевченка, 2Д', ARRAY['+380931127733'])
ON CONFLICT DO NOTHING;

-- Категорії Doma Pizza (location_id = 1)
INSERT INTO categories (location_id, name, icon, sort_order) VALUES
    (1, 'Піца', '🍕', 1),
    (1, 'Суші та роли', '🍣', 2),
    (1, 'Боули та салати', '🥗', 3),
    (1, 'Закуски', '🍟', 4),
    (1, 'Десерти', '🍰', 5),
    (1, 'Напої', '🥤', 6)
ON CONFLICT DO NOTHING;

-- Категорії Doma Croissants (location_id = 2)
INSERT INTO categories (location_id, name, icon, sort_order) VALUES
    (2, 'Круасани', '🥐', 1),
    (2, 'Напої', '☕', 2)
ON CONFLICT DO NOTHING;

-- Товар: Il Tonna (категорія "Піца", id=1)
INSERT INTO products (category_id, name, description, image_url, sort_order) VALUES
    (1, 'Il Tonna',
     'Тонке фірмове тісто, білий фірмовий соус, сир моцарела, філе тунця консервоване, оливки, пармезан, фірмова комбінація спецій.',
     NULL, 1)
ON CONFLICT DO NOTHING;

INSERT INTO product_variants (product_id, label, weight, price, sort_order) VALUES
    (1, 'S', '25 см / 550 г', 249, 1),
    (1, 'M', '32 см / 900 г', 349, 2),
    (1, 'XL', '40 см / 1500 г', 499, 3),
    (1, '3XL', '60 см / 2000 г', 599, 4)
ON CONFLICT DO NOTHING;

-- Товар: Бургер піца (категорія "Піца")
INSERT INTO products (category_id, name, description, image_url, sort_order) VALUES
    (1, 'Бургер піца', 'Піца з начинкою у стилі бургера.', NULL, 2)
ON CONFLICT DO NOTHING;

INSERT INTO product_variants (product_id, label, weight, price, sort_order) VALUES
    (2, 'S', '25 см / 550 г', 249, 1),
    (2, 'M', '32 см / 900 г', 349, 2)
ON CONFLICT DO NOTHING;

-- Товар: Круасан класичний (категорія "Круасани", id=7)
INSERT INTO products (category_id, name, description, image_url, sort_order) VALUES
    (7, 'Круасан класичний', 'Свіжовипечений круасан з вершковим маслом.', NULL, 1)
ON CONFLICT DO NOTHING;

INSERT INTO product_variants (product_id, label, weight, price, sort_order) VALUES
    (3, '1 шт.', '80 г', 65, 1)
ON CONFLICT DO NOTHING;