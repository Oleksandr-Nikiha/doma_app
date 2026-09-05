-- seed_catalog.sql
-- Тестові дані каталогу, зібрані з domapizza.com.ua (станом на 2026-09-05).
--
-- Розраховано на ЧИСТУ базу після 0001_init.sql: повторний запуск створить дублі,
-- бо унікальних обмежень на назви немає.
--
-- Джерело даних:
--   Піца            https://domapizza.com.ua/pizza/
--   Суші та роли    https://domapizza.com.ua/sushii/
--   Боули та салати https://domapizza.com.ua/bowls/
--   Закуски         https://domapizza.com.ua/zakesky/
--   Десерти         https://domapizza.com.ua/deserty/
--   Напої           https://domapizza.com.ua/napiy/
--
-- Структура (рішення, а не дані сайту):
--   * Категорії дворівневі. Товари висять ТІЛЬКИ на листках; «Десерти» і «Круасани»
--     листки самі по собі, бо ділити 5 піццел на підкатегорії немає сенсу.
--   * Хенд-роли перенесено із «Суші та роли» у «Закуски», салат Хіяши Вакаме —
--     у «Боули та салати». На сайті вони лежали серед ролів.
--   * Безіменну першу секцію піц названо «Фірмові». Решта назв підкатегорій —
--     із заголовків секцій сайту.
--   * «Cola, Fanta, Sprite» розбито на три товари: як один товар вони не дають
--     обрати смак у групі опцій боксів.
--   * Категорія «Соуси» прихована (is_visible = false) — її товари існують лише
--     як позиції груп опцій, окремо в меню не показуються. Ціна 0: сайт віддає
--     ці соуси безкоштовно, окремого прайсу на них немає.
--
-- Відомі розбіжності самого джерела (лишені як є, крім позначеного):
--   * «Чотири сири»: 60-см піца підписана як XL — виправлено на 3XL за діаметром,
--     інакше в товарі було б дві мітки XL
--   * «Медова груша»: розмір M коштує 329 замість 429 у решти піц
--   * Напої на /deserty/ і /napiy/ мають різні ціни; узято прайс із /napiy/
--   * Doma Croissants: сайт на реконструкції, позицій немає — категорія порожня
--   * Одруки в назвах виправлено лише там, де на назву посилаються групи опцій:
--     «Картоплая» → «Картопля», «Вишгоордський» → «Вишгородський», а також
--     зведено різнобій тире в чотирьох «Хенд – рол» → «Хенд-рол».
--     Решта одруків сайту («тунец», «вугорь», «Супе МакіСЕТ») лишені як є.

BEGIN;

-- --- Заклади ---
INSERT INTO locations (name, address, phones) VALUES
    ('Doma Pizza', 'Вишгород, вул. Набережна, 8Д', ARRAY['+380671127733','+380631127733']),
    -- адреса й телефон узяті з попереднього сиду: сайт закладу на реконструкції
    ('Doma Croissants', 'Вишгород, просп. Шевченка, 2Д', ARRAY['+380931127733']);

-- --- Кореневі категорії ---
INSERT INTO categories (location_id, parent_id, name, icon, is_visible, sort_order)
SELECT id, NULL::INTEGER, 'Піца', '🍕', true, 1 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Суші та роли', '🍣', true, 2 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Боули та салати', '🥗', true, 3 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Закуски', '🍟', true, 4 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Десерти', '🍰', true, 5 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Напої', '🥤', true, 6 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Соуси', '🥫', false, 99 FROM locations WHERE name = 'Doma Pizza'
UNION ALL
SELECT id, NULL::INTEGER, 'Круасани', '🥐', true, 1 FROM locations WHERE name = 'Doma Croissants';

-- --- Підкатегорії ---
INSERT INTO categories (location_id, parent_id, name, sort_order)
SELECT p.location_id, p.id, 'Фірмові', 1 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Піца'
UNION ALL
SELECT p.location_id, p.id, 'Мікс на чотири', 2 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Піца'
UNION ALL
SELECT p.location_id, p.id, 'Особливі смаки', 3 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Піца'
UNION ALL
SELECT p.location_id, p.id, 'Класичні смаки', 4 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Піца'
UNION ALL
SELECT p.location_id, p.id, 'Сети з ролів', 1 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Спрінг чіз', 2 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли запечені', 3 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Fresh', 4 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Філадельфія', 5 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Каліфорнія', 6 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Макі', 7 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Особливі роли', 8 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Роли Дракон', 9 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Суші та роли'
UNION ALL
SELECT p.location_id, p.id, 'Боули', 1 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Боули та салати'
UNION ALL
SELECT p.location_id, p.id, 'Салати', 2 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Боули та салати'
UNION ALL
SELECT p.location_id, p.id, 'Хенд-роли', 1 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Закуски'
UNION ALL
SELECT p.location_id, p.id, 'Роли в тортильї', 2 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Закуски'
UNION ALL
SELECT p.location_id, p.id, 'Бокси', 3 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Закуски'
UNION ALL
SELECT p.location_id, p.id, 'Фокачі', 4 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Закуски'
UNION ALL
SELECT p.location_id, p.id, 'Картопля', 5 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Закуски'
UNION ALL
SELECT p.location_id, p.id, 'Газовані', 1 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Напої'
UNION ALL
SELECT p.location_id, p.id, 'Соки', 2 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Напої'
UNION ALL
SELECT p.location_id, p.id, 'Вода', 3 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Напої'
UNION ALL
SELECT p.location_id, p.id, 'Енергетики', 4 FROM categories p JOIN locations l ON l.id = p.location_id WHERE l.name = 'Doma Pizza' AND p.parent_id IS NULL AND p.name = 'Напої';

-- ========== Піца / Фірмові ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Il Tonna', 'Тонке фірмове тісто, білий фірмовий соус, сир моцарела, філе тунця консервоване, оливки, пармезан, фірмова комбінація спецій.',
           'https://domapizza.com.ua/wp-content/uploads/ИльТона-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 550 г', 329, 1),
        ('M', '32 см / 900 г', 429, 2),
        ('XL', '40 см / 1500 г', 589, 3),
        ('3XL', '60 см / 2000 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піца з Верони', 'Тонке фірмове тісто, сир моцарела, соус фірмовий, салямі, курка, шинка, чедр, цибуля',
           'https://domapizza.com.ua/wp-content/uploads/Верона-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 550 г', 329, 1),
        ('M', '32 см / 770 г', 429, 2),
        ('XL', '40 см / 1300 г', 589, 3),
        ('3XL', '60 см / 1950 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'ТМЩЯТЛ', 'Тонке фірмове тісто, білий фірмовий соус, сир моцарела, курка копчена, помідорки вʼялені, кульки моцарили бебік, рукола, соус песто фірмовий, часник',
           'https://domapizza.com.ua/wp-content/uploads/ТМЩЯТБЛ-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 660 г', 329, 1),
        ('M', '32 см / 860 г', 429, 2),
        ('XL', '40 см / 1250 г', 589, 3),
        ('3XL', '60 см / 1750 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піца з Бергамо', 'моцарела, соус фірмовий вершковий, прошутто, сир Дор Блю, груша, рукола, пармезан, фірмовий медовий соус',
           'https://domapizza.com.ua/wp-content/uploads/Бергамо-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 440 г', 329, 1),
        ('M', '32 см / 700 г', 429, 2)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Феттуччі піца', 'Тонке фірмове тість, фірмовий вершковий соус, курка, помідор, солодкий перець, Фета, фірмова комбінація спецій.',
           'https://domapizza.com.ua/wp-content/uploads/Фетучо-400x400.webp', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 770 г', 429, 2),
        ('XL', '40 см / 1400 г', 589, 3),
        ('3XL', '60 см / 2200 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Бургер піца', 'фарш мʼясного асорті, соус бургер, сир моцарелла, сир бургерний, цибуля, огірки солені, помідори, цибуля кран, фірмова приправа',
           'https://domapizza.com.ua/wp-content/uploads/Бургер-400x400.webp', 6
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Фірмові'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 660 г', 329, 1),
        ('M', '32 см / 860 г', 429, 2),
        ('XL', '40 см / 1400 г', 589, 3),
        ('3XL', '60 см / 2200 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

-- ========== Піца / Мікс на чотири ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Чотири сири', 'Тонке тісто, сир моцарела, соус вершковий, сир Дор-Блю, сир Чедер, сир Пармезан, базилік, прованські трави.',
           'https://domapizza.com.ua/wp-content/uploads/4Сира-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Мікс на чотири'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 430 г', 329, 1),
        ('M', '32 см / 630 г', 429, 2),
        ('XL', '40 см / 1050 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Чотири м’яса', 'Тонке тісто, сир моцарела, соус томатний, ковбаски єгерські, філе курки, бекон, шинка, печериці, солоний огірок, прованські трави.',
           'https://domapizza.com.ua/wp-content/uploads/4Мяса-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Мікс на чотири'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 800 г', 429, 2),
        ('XL', '40 см / 1400 г', 589, 3),
        ('3XL', '60 см / 2300 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Чотири океани', 'Тонке тісто, сир моцарела, соус вершковий, маслини, сир Пармезан, базилік, креветка, філе тунця, філе лосося свіже та молосолоне, м’ясо мідії, прованські трави.',
           'https://domapizza.com.ua/wp-content/uploads/4Океани-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Мікс на чотири'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 630 г', 429, 2),
        ('XL', '40 см / 1100 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

-- ========== Піца / Особливі смаки ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія', 'Тонке тісто, сир моцарела, соус вершковий, сир Пармезан, базилік, філе лосося свіже та молосолоне, руккола, прованські трави.',
           'https://domapizza.com.ua/wp-content/uploads/Філадельфія-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 630 г', 429, 2),
        ('XL', '40 см / 1100 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'А-ля Карбонара', 'Тонке тісто, сир моцарела, соус Вершковий, бекон, цибуля Порей, помідори, сир Пармезан',
           'https://domapizza.com.ua/wp-content/uploads/Карбонара-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 450 г', 329, 1),
        ('M', '32 см / 700 г', 429, 2),
        ('XL', '40 см / 1150 г', 589, 3),
        ('3XL', '60 см / 1700 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'А-ля Капричоза', 'Тонке тісто, сир моцарела, соус томатний, шинка, гриби печериці, помідори, перець, комбінація фірмових спецій, соус солодкий чілі',
           'https://domapizza.com.ua/wp-content/uploads/Капричоза-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 750 г', 429, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 2000 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Мюнхенська', 'Тонке тісто, сир моцарела, соус з томатів Пілаті, шинка, охотнічі ковбаски, Мюнхенські ковбаски, помідори, комбінація фірмових спецій, гірчиця Американська.',
           'https://domapizza.com.ua/wp-content/uploads/Мюнхінька-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 450 г', 329, 1),
        ('M', '32 см / 750 г', 429, 2),
        ('XL', '40 см / 1150 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Кантрі', 'Тонке тісто, сир моцарела, соус томатний, цибуля солодка, бекон, шинка, огірок, маслини, цибулька зелена.',
           'https://domapizza.com.ua/wp-content/uploads/Кантр-400x400.webp', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 710 г', 429, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Гавайська', 'Тонке тісто, сир моцарела, соус томатний, вершки, філе курки, кукурудза, шинка, ананас.',
           'https://domapizza.com.ua/wp-content/uploads/Гавайська-400x400.webp', 6
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 710 г', 429, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 1700 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Фреш', 'Тонке тісто, сир моцарела, соус томатний, цибуля солодка, печериці, кукурудза, помідор, перець солодкий',
           'https://domapizza.com.ua/wp-content/uploads/Фреш-1-400x400.webp', 7
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 550 г', 329, 1),
        ('M', '32 см / 820 г', 429, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Цезар', 'Тонке тісто, сир моцарела, соус Цезарь, копчена курка, бекон, помідори, листя ромена, сир Пармезан',
           'https://domapizza.com.ua/wp-content/uploads/Цезар-400x400.webp', 8
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 540 г', 329, 1),
        ('M', '32 см / 750 г', 429, 2),
        ('XL', '40 см / 1400 г', 589, 3),
        ('3XL', '60 см / 2000 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'El Diablo (Ель Д’ябло)', 'Тонке тісто, сир моцарела, соус томатний, ковбаса салямі, ковбаски єгерські, перець халапеньо, соус чілі.',
           'https://domapizza.com.ua/wp-content/uploads/ЕльДьябло-400x400.webp', 9
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 470 г', 329, 1),
        ('M', '32 см / 700 г', 429, 2),
        ('XL', '40 см / 1100 г', 589, 3),
        ('3XL', '60 см / 2000 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Honey Meat (Ханей Міт)', 'Тонке тісто, сир моцарела, соус томатний, ковбаса салямі, шинка, сир ДорБлю, Сир Пармезан, руккола, фірмовий медовий соус.',
           'https://domapizza.com.ua/wp-content/uploads/ХаниМит-400x400.webp', 10
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 800 г', 429, 2),
        ('XL', '40 см / 1100 г', 589, 3),
        ('3XL', '60 см / 1800 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Американо', 'Тонке тісто, сир моцарела, соус з томатів Пілаті, картопля фрі з печі, ХотДог ковбаски, сир Пармезан, комбінація спецій, соус фармовий томатний',
           'https://domapizza.com.ua/wp-content/uploads/Американо-400x400.webp', 11
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 700 г', 329, 1),
        ('M', '32 см / 1100 г', 429, 2),
        ('XL', '40 см / 1600 г', 589, 3),
        ('3XL', '60 см / 2000 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Let’s Bianco (Летс Б’янко)', 'Тонке тісто, сир моцарела, соус вершковий, фірмове філе курки, печериці, помідори, сир Пармезан, фірмова комбінація спецій.',
           'https://domapizza.com.ua/wp-content/uploads/Лецбьянка-400x400.webp', 12
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 470 г', 329, 1),
        ('M', '32 см / 800 г', 429, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 1600 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Медова груша', 'Тонке тісто, сир моцарела, соус вершковий, сир ДорБлю, груша, горіх Волоський, мед, гострий перець',
           'https://domapizza.com.ua/wp-content/uploads/Грушка-400x400.webp', 13
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Особливі смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 470 г', 329, 1),
        ('M', '32 см / 800 г', 329, 2),
        ('XL', '40 см / 1200 г', 589, 3),
        ('3XL', '60 см / 1750 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

-- ========== Піца / Класичні смаки ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Маргарита', 'Тонке тісто, сир моцарела, соус томатний, помідори, сир Пармезан',
           'https://domapizza.com.ua/wp-content/uploads/Маргорита-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Класичні смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 430 г', 329, 1),
        ('M', '32 см / 630 г', 429, 2),
        ('XL', '40 см / 1050 г', 589, 3),
        ('3XL', '60 см / 1450 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Салямі', 'Тонке тісто, сир моцарела, соус томатний, ковбаса салямі',
           'https://domapizza.com.ua/wp-content/uploads/Пеперони-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Класичні смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 450 г', 329, 1),
        ('M', '32 см / 600 г', 429, 2),
        ('XL', '40 см / 1000 г', 589, 3),
        ('3XL', '60 см / 1550 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'BBQ', 'Тонке тісто, сир моцарела, соус BBQ, солодка цибуля, ковбаски єгерські, філе курки, печериці, кукурудза, перець солодкий',
           'https://domapizza.com.ua/wp-content/uploads/BBQ-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Піца' AND c.name = 'Класичні смаки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('S', '25 см / 500 г', 329, 1),
        ('M', '32 см / 650 г', 429, 2),
        ('XL', '40 см / 1280 г', 589, 3),
        ('3XL', '60 см / 1680 г', 689, 4)
    ) AS v(label, weight, price, sort_order);

-- ========== Закуски / Хенд-роли ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хенд-рол з лососем', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Хенд-рол-з-лососем-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Хенд-роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '310 г', 280, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хенд-рол з вугрем', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Хенд-рол-з-вугрем-500x500.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Хенд-роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '310 г', 280, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хенд-рол з тигровою креветкою', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Хенд-рол-з-криветкою-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Хенд-роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '310 г', 280, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хенд-рол СЕТ', 'Хенд-рол з лососем, Хенд-рол з вугрем, Хенд-рол з тигровою креветкою',
           'https://domapizza.com.ua/wp-content/uploads/Хенд-рол-СЕТ-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Хенд-роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '930 г', 700, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Особливі роли ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'nOLiveAs… рол', 'Рис, норі, філе лосося смажене, філе лосося свіже, помідор, авокадо, салат айсберг, соусоус унагі',
           'https://domapizza.com.ua/wp-content/uploads/2024/05/IMG_3841-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '390 г', 300, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Asamo рол', 'Рис, сир филадельфия, норі, філе лосося смажене, мідії, огірок, помідор, соус солодкий Чілі',
           'https://domapizza.com.ua/wp-content/uploads/2024/05/2024-05-10-09.41.09-500x428.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '390 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Margo&Rita рол', 'Рис, норі, філе тунця, мідії, авокадо, огірок, чука, горіхова-кунжутний соус',
           'https://domapizza.com.ua/wp-content/uploads/2024/05/IMG_3842-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '390 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Окінава', 'рис, сир філадельфія, шитакі, креветка, вугорь, ікра тобіко, унагі соус, кунжут, суха цибля',
           'https://domapizza.com.ua/wp-content/uploads/2021/06/okinava-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 245, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Футомакі', 'рис,сир філадельфія,лосось,вугорь,авокадо, ікра тобіко, огірок',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/futomaki-400x400.jpg', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '300 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'DomaMaguro (ДомаМагуро)', 'рис, сир філадельфія, тунець запечений, цибуля зелена, огірок, ікра тобіко',
           'https://domapizza.com.ua/wp-content/uploads/2021/07/photo_2021-07-15_14-41-30-400x400.jpg', 6
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Особливі роли'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '245 г', 190, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Сети з ролів ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Супер філадельфія сет', 'Рол філадельфія лосось, Рол філадельфія тунець Рол філадельфія вугор, Рол філадельфія креветка, Рол філадельфія авокадо (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2023/05/супер-філа-сет-400x400.png', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('40 шт.', '1350 г', 1250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, '50/50 сет', 'Рол філадельфія вугор, Рол філадельфія креветка, Рол каліфорнія тунець,Рол каліфорнія лосось (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2023/05/філакаліфа-сет-400x400.png', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('32 шт.', '1040 г', 800, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Супе МакіСЕТ', 'СуперМакі Лосось рол, СупеМакі Вугор рол, СуперМакі Тунець рол, СуперМакі Тигрова Креветка рол, СупеМАкі Авокадо рол.',
           'https://domapizza.com.ua/wp-content/uploads/2025/01/IMG_4901.PNG-400x400.png', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('40 шт.', '1150 г', 700, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Супер дракон сет', 'Рол золотий дракон, Рол червоний дракон, Рол зелений дракон,Рол тигровий дракон, Рол білий дракон (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2023/05/скпер-дракон-сет-400x400.png', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('40 шт.', '1400 г', 1300, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Супер Лосось сет', 'Рол філадельфія лосось, Рол червоний дракон, Рол каліфорнія лосось в ікрі тобіко, Рол леопард чіз (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2023/06/лосось-сет-400x400.jpg', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('32 шт.', '1140 г', 1040, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія сет', 'Філадельфія лосось, Філадельфія тунец, Філадельфія вугорь (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/filadelfiia-set-1-400x400.jpg', 6
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('24 шт.', '830 г', 700, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Каліфорнія сет', 'Каліфорнія тобіка лосось, Каліфорнія тобіка тунец, Каліфорнія вугорь, Каліфорнія креветка (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/kaliforniia-set-400x400.jpg', 7
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('32 шт.', '920 г', 850, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон сет', 'Дракон Золотий, Дракон Зелений, Дракон Червоний (Склад ролів зазанчено нижче до кожного рола окремо)ʼ',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/drakon-set-400x400.jpg', 8
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('24 шт.', '790 г', 900, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі сет', 'Макі лосось, Макі тунец, Макі вугорь, Макі креветка, Макі Огірок (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-set-2-400x400.jpg', 9
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('30 шт.', '500 г', 420, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Запечений сет (НОВИЙ – 4 роли)', 'Рол Запечений лосось, Рол Запечений вугорь, Рол Запечена креветка, Рол Запевений тунець (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2022/01/IMG_7979-400x400.jpg', 10
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('32 шт.', '1400 г', 950, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'DomaFresh (ДомаФреш)', 'Рол ФрешЛайф, Рол ФрешРед, Рол ФрешБоніто (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2021/07/photo_2021-07-28_18-42-31-400x400.jpg', 11
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('24 шт.', '740 г', 650, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Спрінг чіз', 'Рол Леопард чіз, Рол Тигр чіз, Рол Пантера чіз (Склад ролів зазанчено нижче до кожного рола окремо)',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/4-400x400.png', 12
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('24 шт.', '1100 г', 1050, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Vікторія сет', 'Рол Asamo, Рол nOLiveAs, Рол Margi&Rita',
           'https://domapizza.com.ua/wp-content/uploads/2024/12/IMG_4807-400x400.jpg', 13
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Сети з ролів'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('24 шт.', '1100 г', 800, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Спрінг чіз ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Леопард чіз', 'Рис, сир филадельфия, норі, груша, філе тунецю, сир Чедр, філе лосося, соус солодкий чілі',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/2-400x400.png', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Спрінг чіз'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '370 г', 330, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Тигр чіз', 'Рис, сир филадельфия, норі, груша, креветка тигрова, сир Чедр, філе тунця, соус Унагі, кранч цибуля',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/1-400x400.png', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Спрінг чіз'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '370 г', 330, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Пантера чіз', 'Рис, сир филадельфия, норі, груша, сир Чедр, вугорь, унагі соус, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/3-400x400.png', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Спрінг чіз'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '370 г', 330, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли запечені ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Запечений лосось', 'Філе лосося, норі, рис, сир філадельфія, авокадо, икра, сирная шапочка (сир, майонез)',
           'https://domapizza.com.ua/wp-content/uploads/2022/01/IMG_7739-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли запечені'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '350 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Запечений вугорь', 'Вугорь, норі. рис, сир філадельфія, кунжут, авокадо, сирная шапочка (сир, майонез), соус Унагі',
           'https://domapizza.com.ua/wp-content/uploads/2022/01/IMG_7899-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли запечені'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '350 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Запечена креветка', 'Креветка, норі, рис, сир філадельфія, авокадо, ікра, сирная шапочка (сир, майонез)',
           'https://domapizza.com.ua/wp-content/uploads/2022/01/IMG_7871-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли запечені'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '350 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Запечений тунець', 'Тунець, норі, рис, сир філадельфія, авокадо, стружка тунця, сирная шапочка (сир, майонез)',
           'https://domapizza.com.ua/wp-content/uploads/2022/05/20220503-DSC_0009-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли запечені'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '350 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Fresh ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'FreshLife (ФрешЛайф)', 'Рис, сир филадельфия, гриб шитакі, чука, огірок, кунжутне насіння',
           'https://domapizza.com.ua/wp-content/uploads/2021/07/3333333-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Fresh'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '230 г', 160, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'FreshRed (ФрешРед)', 'Рис, сир филадельфия, чука, філе лосося, філе тунця, ікра тобіко, кунжутне насіння',
           'https://domapizza.com.ua/wp-content/uploads/2021/07/1-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Fresh'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 225, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'FreshBonito (ФрешБоніто)', 'Рис, сир филадельфия, чука, филе лосося, стружка тунця',
           'https://domapizza.com.ua/wp-content/uploads/2021/07/2-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Fresh'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '240 г', 210, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Філадельфія ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія лосось', 'Рис, сир филадельфия, огірок, филе лосося',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/fylodelfyia-s-lososem-1-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Філадельфія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія тунец', 'Рис, сир филадельфия, огірок, филе тунеця, кунжут, цибуля зелена',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/fyladelfyia-s-tuntsom-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Філадельфія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 260, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія вугорь', 'Рис, сир филадельфия, огірок, вугорь, кунжут, унагі соус, цибуя суха',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/felodelfyia-s-uhrem-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Філадельфія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '290 г', 270, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Філадельфія креветка', 'Рис, сир филадельфия, огірок, креветка тігрова, соус солодкий чілі, цибуля суха',
           'https://domapizza.com.ua/wp-content/uploads/2022/05/20220503-DSC_0004-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Філадельфія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '290 г', 270, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Каліфорнія ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Каліфорнія лосось', 'рис, сир филадельфия, філе лосося, огірок, авокадо, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/kaliforniia-losos-1-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Каліфорнія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '230 г', 210, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Каліфорнія тунец', 'рис, сир филадельфия, філе тунця, огірок, авокадо, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/kaliforniia-z-tuntsem-1-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Каліфорнія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '230 г', 210, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Каліфорнія вугорь', 'рис, сир филадельфия, вугор, огірок, авокадо, кунжут, унагі соус',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/kaliforniia-z-vuhrem-1-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Каліфорнія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '230 г', 210, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Каліфорнія креветка', 'рис, сир филадельфия, креветка, огірок, авокадо, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/kaliforniia-z-krevetkoiu-2-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Каліфорнія'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '230 г', 220, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Макі ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі лосось', NULL,
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-z-lososem-1-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Макі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('6 шт.', '100 г', 102, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі тунец', NULL,
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-z-tuntsem-1-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Макі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('6 шт.', '100 г', 102, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі вугорь', 'рис, огірок, вугор, кунжут, унагі соус',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-z-vuhrem-1-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Макі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('6 шт.', '100 г', 117, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі креветка', NULL,
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-krevetka-1-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Макі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('6 шт.', '100 г', 113, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Макі Огірок', 'рис, огірок, кунжут, унагі соус',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/maki-z-ohirkom-400x400.jpg', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Макі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('6 шт.', '100 г', 85, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Боули та салати / Салати ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Салат Хіяши Вакаме', 'кунжут, фірмовий горіховий соус, водорослі чука',
           'https://domapizza.com.ua/wp-content/uploads/2021/10/2361545170_w600_h600_2361545170-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Салати'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '210 г', 125, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Суші та роли / Роли Дракон ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон Золотий', 'рис, сир філадельфія, вугор,лосось, токуан, гриб шиитаке, ікра тобіко, унагі сосус, кунжут, цибуля суха',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/drakon-zolotyi-400x400.jpg', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Дракон'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '260 г', 280, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон Зелений', 'рис, сир філадельфія, вугор, авокадо, ікра тобіко, огірок, кунжут, унагі соус, цибуля суха',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/drakon-zelenyi-1-400x400.jpg', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Дракон'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '260 г', 265, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон Червоний', 'рис, вугор, лосось, огірок, токуан',
           'https://domapizza.com.ua/wp-content/uploads/2021/03/drakon-chervonyi-1-400x400.jpg', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Дракон'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 270, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон Тигровий', 'рис, креветка, лосось, авокадо, ікра тобіко, сир філадельфія, соус солодкий чілі, суха цибуля',
           'https://domapizza.com.ua/wp-content/uploads/2022/05/20220503-DSC_0007-400x400.jpg', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Дракон'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '270 г', 280, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Дракон Білий', 'рис, креветка, лосось, авокадо, ікра тобіко, сир філадельфія, сир тестовий чедр, соус унагі',
           'https://domapizza.com.ua/wp-content/uploads/2024/12/IMG_4808-400x400.png', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Суші та роли' AND c.name = 'Роли Дракон'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('8 шт.', '250 г', 200, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Боули та салати / Боули ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Боул з лососем та крем сиром', 'Рис фірмовий заправлений, Філе лосося, крем сир, персик консервований, авокадо, чука, соус горіховий, соус Унагі, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/З-лососем-та-крем-сиром-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Боули'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 350 г', 360, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Боул з вугрем та рукколою', 'Рис фірмовий заправлений, філе Вугря, гриби Шиїтаке, авокадо, чука, крем сир, соус горіховий, соус Унагі, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/З-вугрем-та-чукою-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Боули'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 350 г', 400, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Боул з тунцем та персиком', 'Рис фірмовий заправлений, філе Тунця, персик консервований, руккола, авокадо, огірок, соус Унагі, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/З-тунцем-та-персиком-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Боули'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 350 г', 360, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Боул з креветкою та авокадо', 'Рис фірмовий заправлений, креветка Тігрова, огірок, кран цибуля, авокадо, персик консервваний, соус солодкий чілі, соус Унагі,',
           'https://domapizza.com.ua/wp-content/uploads/З-креветкою-та-авокадо-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Боули'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 360 г', 380, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Боул з фетою та грушою', 'Рис фірмовий заправлений, Фета, груша свіжа, салат Айсберг, соус горіховий, соус Унагі, кунжут',
           'https://domapizza.com.ua/wp-content/uploads/З-фетою-та-грушою-400x400.webp', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Боули та салати' AND c.name = 'Боули'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 200, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Закуски / Картопля ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Картопля фрі з печі', 'Картопля, комбінація спецій, сіль',
           'https://domapizza.com.ua/wp-content/uploads/Картопля-1-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Картопля'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '200 г', 110, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Закуски / Роли в тортильї ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Чікен рол', 'Тартилья, Курячі нагетси, салат Асберг, помідор, соус фірмовий',
           'https://domapizza.com.ua/wp-content/uploads/Чікен-рол-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Роли в тортильї'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '300 г', 135, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Верона рол', 'Тартилья, Салямі, Шинка, Філе куряче, Моцарела, Цибуля, Чедр, Фірмовий соус, комбінація фірмових спецій',
           'https://domapizza.com.ua/wp-content/uploads/Верона-рол-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Роли в тортильї'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '250 г', 135, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Вишгородський рол', 'Тартилья, Бекон, Халапеньо, Моцарела, Фірмоуий соус, комбінація фірмових спецій',
           'https://domapizza.com.ua/wp-content/uploads/Вишгородський-рол-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Роли в тортильї'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '250 г', 135, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Цезар рол', 'Тартилья, Бекон, Філе куряче, Помідор, Моцарела, Фірмовий соус Цезар, Комбінація фірмових спецій',
           'https://domapizza.com.ua/wp-content/uploads/Цезарь-рол-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Роли в тортильї'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '250 г', 135, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хані міт роллінг', 'Тартилья, Салямі, Шинка, Рукола, Крем сир,Моцарела, Пармезан, Дор-Блю, Фірмовий соус Медово-гірчичний',
           'https://domapizza.com.ua/wp-content/uploads/Хані-міт-роллінг-400x400.webp', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Роли в тортильї'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '250 г', 135, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Закуски / Бокси ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Чікен рол бокс', 'Чікен рол, картопля фрі з печі, напій',
           'https://domapizza.com.ua/wp-content/uploads/Чікен-рол-бокс-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Бокси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '500 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Верона рол бокс', 'Верона рол, картопля фрі з печі, напій',
           'https://domapizza.com.ua/wp-content/uploads/Верона-рол-бокс-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Бокси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '430 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Вишгородський рол бокс', 'Вишгородський рол, картопля фрі з печі, напій',
           'https://domapizza.com.ua/wp-content/uploads/Вишгородський-рол-бокс-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Бокси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '430 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Цезар рол бокс', 'Цезар рол, картопля фрі з печі, напій',
           'https://domapizza.com.ua/wp-content/uploads/Цезарь-рол-бокс-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Бокси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '430 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Хані міт роллінг бокс', 'Хані кіт роллинг, картопля фрі з печі, напій',
           'https://domapizza.com.ua/wp-content/uploads/Хані-міт-роллінг-бокс-400x400.webp', 5
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Бокси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '430 г', 250, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Закуски / Фокачі ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Фокачі Вишгородський (гострий)', 'Тонке фірмове тісто, сир Моцарелла. бекон, перець халапеньо, сирна пікнтна приправа',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/коржик-вишг-400x400.png', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Фокачі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '380 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Фокачі Мюнхенський', 'Тонке фірмове тісто, сир Моцарелла. Ковбаски мисливські. Ковбаски Мюгнхенські. гірчиця, сирна пікантна приправа',
           'https://domapizza.com.ua/wp-content/uploads/2023/04/коржик-мюнх-400x400.png', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Закуски' AND c.name = 'Фокачі'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', '380 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Десерти ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піццелла Дубайська', 'Начинка з меленої фісташки, шоколаду та горішків у фірмовому тісті з цукровою пудрою',
           'https://domapizza.com.ua/wp-content/uploads/Дубайська-піццелла-1-400x400.webp', 1
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Десерти'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піццелла з маком', 'Макова начинка у фірмовому тісті з цукровою пудрою',
           'https://domapizza.com.ua/wp-content/uploads/Піцелла-з-маком-400x400.webp', 2
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Десерти'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піццелла з маком та вишнею', 'Начинка з маком, вишнями у фірмовому тісті з цукровою пудрою',
           'https://domapizza.com.ua/wp-content/uploads/Піцелла-з-маком-та-вишнею-400x400.webp', 3
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Десерти'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піццелла з маком та яблуком', 'Начинка з маком та яблуками у фірмовому тісті з цукровою пудрою',
           'https://domapizza.com.ua/wp-content/uploads/Піцелла-з-маком-та-яблуком-400x400.webp', 4
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Десерти'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Піццелла', 'Фруктова або ягідна начинка у фірмовому тісті з цукровою пудро.',
           'https://domapizza.com.ua/wp-content/uploads/Піццелла-400x400.webp', 5
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Десерти'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('1 порція', 'від 300 г', 140, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Напої / Газовані ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Cola', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_6zmplu6zmplu6zmp-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Газовані'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.2 л (скло)', NULL, 55, 1),
        ('0.33 л', NULL, 55, 2),
        ('0.5 л', NULL, 60, 3),
        ('1.2 л', NULL, 80, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Fanta', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_6zmplu6zmplu6zmp-400x400.webp', 2
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Газовані'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.2 л (скло)', NULL, 55, 1),
        ('0.33 л', NULL, 55, 2),
        ('0.5 л', NULL, 60, 3),
        ('1.2 л', NULL, 80, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Sprite', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_6zmplu6zmplu6zmp-400x400.webp', 3
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Газовані'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.2 л (скло)', NULL, 55, 1),
        ('0.33 л', NULL, 55, 2),
        ('0.5 л', NULL, 60, 3),
        ('1.2 л', NULL, 80, 4)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Швепс', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_h9e5hvh9e5hvh9e5-400x400.webp', 4
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Газовані'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.33 л', NULL, 50, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Напої / Соки ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Сік', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_fjhv4gfjhv4gfjhv-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Соки'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.2 л', NULL, 40, 1),
        ('1.0 л', NULL, 140, 2)
    ) AS v(label, weight, price, sort_order);

-- ========== Напої / Вода ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Вода мінеральна', NULL,
           'https://domapizza.com.ua/wp-content/uploads/bonaqua-drink-2-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Вода'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.5 л', NULL, 40, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Напої / Енергетики ==========

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Monster energy (в асортименті)', NULL,
           'https://domapizza.com.ua/wp-content/uploads/Gemini_Generated_Image_1wv93c1wv93c1wv9-400x400.webp', 1
    FROM categories c
    JOIN categories parent ON parent.id = c.parent_id
    JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND parent.name = 'Напої' AND c.name = 'Енергетики'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('0.5 л (бляшанка)', NULL, 90, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Соуси (прихована категорія) ==========
-- Окремо в меню не показуються: існують лише як позиції груп опцій.

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Соус гостро-солодкий', NULL,
           NULL, 1
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('порція', NULL, 0, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Соус спайсі', NULL,
           NULL, 2
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('порція', NULL, 0, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Соус унагі', NULL,
           NULL, 3
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('порція', NULL, 0, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Кетчуп', NULL,
           NULL, 4
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('порція', NULL, 0, 1)
    ) AS v(label, weight, price, sort_order);

WITH new_product AS (
    INSERT INTO products (category_id, name, description, image_url, sort_order)
    SELECT c.id, 'Сирний соус', NULL,
           NULL, 5
    FROM categories c JOIN locations l ON l.id = c.location_id
    WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
    RETURNING id
)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT new_product.id, v.label, v.weight, v.price, v.sort_order
FROM new_product, (VALUES
        ('порція', NULL, 0, 1)
    ) AS v(label, weight, price, sort_order);

-- ========== Групи опцій ==========

INSERT INTO option_groups (name, sort_order) VALUES
    ('Соус до хенд-ролу', 1),
    ('Соус до картоплі', 2),
    ('Напій 0.5 л', 3);

-- Позиції груп. price_delta = 0: сайт віддає ці соуси й напої в комплекті безкоштовно.
INSERT INTO option_group_items (group_id, variant_id, price_delta, sort_order)
SELECT g.id, v.id, 0, 1
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Соус до хенд-ролу' AND p.name = 'Соус гостро-солодкий' AND v.label = 'порція'
UNION ALL
SELECT g.id, v.id, 0, 2
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Соус до хенд-ролу' AND p.name = 'Соус спайсі' AND v.label = 'порція'
UNION ALL
SELECT g.id, v.id, 0, 3
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Соус до хенд-ролу' AND p.name = 'Соус унагі' AND v.label = 'порція'
UNION ALL
SELECT g.id, v.id, 0, 1
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Соус до картоплі' AND p.name = 'Кетчуп' AND v.label = 'порція'
UNION ALL
SELECT g.id, v.id, 0, 2
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Соус до картоплі' AND p.name = 'Сирний соус' AND v.label = 'порція'
UNION ALL
SELECT g.id, v.id, 0, 1
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Напій 0.5 л' AND p.name = 'Cola' AND v.label = '0.5 л'
UNION ALL
SELECT g.id, v.id, 0, 2
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Напій 0.5 л' AND p.name = 'Fanta' AND v.label = '0.5 л'
UNION ALL
SELECT g.id, v.id, 0, 3
FROM option_groups g, product_variants v JOIN products p ON p.id = v.product_id
WHERE g.name = 'Напій 0.5 л' AND p.name = 'Sprite' AND v.label = '0.5 л';

-- ========== Групи опцій → товари ==========
-- min_select/max_select живуть саме тут: група «Соус до хенд-ролу» та сама,
-- але звичайний хенд-рол бере 1 соус із 3, а СЕТ — усі 3.

INSERT INTO product_option_groups (product_id, group_id, min_select, max_select, sort_order)
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Хенд-рол з лососем' AND g.name = 'Соус до хенд-ролу'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Хенд-рол з вугрем' AND g.name = 'Соус до хенд-ролу'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Хенд-рол з тигровою креветкою' AND g.name = 'Соус до хенд-ролу'
UNION ALL
SELECT p.id, g.id, 3, 3, 1 FROM products p, option_groups g
WHERE p.name = 'Хенд-рол СЕТ' AND g.name = 'Соус до хенд-ролу'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Картопля фрі з печі' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Чікен рол бокс' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 2 FROM products p, option_groups g
WHERE p.name = 'Чікен рол бокс' AND g.name = 'Напій 0.5 л'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Верона рол бокс' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 2 FROM products p, option_groups g
WHERE p.name = 'Верона рол бокс' AND g.name = 'Напій 0.5 л'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Вишгородський рол бокс' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 2 FROM products p, option_groups g
WHERE p.name = 'Вишгородський рол бокс' AND g.name = 'Напій 0.5 л'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Цезар рол бокс' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 2 FROM products p, option_groups g
WHERE p.name = 'Цезар рол бокс' AND g.name = 'Напій 0.5 л'
UNION ALL
SELECT p.id, g.id, 1, 1, 1 FROM products p, option_groups g
WHERE p.name = 'Хані міт роллінг бокс' AND g.name = 'Соус до картоплі'
UNION ALL
SELECT p.id, g.id, 1, 1, 2 FROM products p, option_groups g
WHERE p.name = 'Хані міт роллінг бокс' AND g.name = 'Напій 0.5 л';

COMMIT;
