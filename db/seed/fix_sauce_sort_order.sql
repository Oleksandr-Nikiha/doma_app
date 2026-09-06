-- fix_sauce_sort_order.sql
-- Разовий фікс для БД, куди «Майонез» і «BBQ» додавали вручну повз сид.
--
-- Для чистої бази не потрібен: seed_catalog.sql уже розставляє ці sort_order.
--
-- Проблема: у трьох соусів до картоплі збігався option_group_items.sort_order
-- (Кетчуп, Майонез і BBQ усі мали 1). Postgres не гарантує порядок рядків
-- з однаковим ключем сортування, тож той самий набір соусів приїжджав у різному
-- порядку на різних товарах — і міг мінятися між запитами на одному й тому ж.
--
-- Цільовий порядок: Кетчуп, Сирний соус, Майонез, BBQ.
--
-- Ідемпотентний: повторний запуск проставить ті самі значення.
--
-- Увага: соус «BBQ» — тезка піци «BBQ». Тому всі вибірки нижче йдуть через
-- категорію «Соуси», а не тільки за назвою товару.

BEGIN;

-- 1. Порядок товарів усередині прихованої категорії «Соуси»
UPDATE products p
SET sort_order = t.sort_order
FROM (VALUES
        ('Кетчуп', 4),
        ('Сирний соус', 5),
        ('Майонез', 6),
        ('BBQ', 7)
    ) AS t(name, sort_order)
JOIN categories c ON c.name = 'Соуси'
WHERE p.name = t.name
  AND p.category_id = c.id;

-- 2. Порядок позицій у групі «Соус до картоплі»
UPDATE option_group_items ogi
SET sort_order = t.sort_order
FROM (VALUES
        ('Кетчуп', 1),
        ('Сирний соус', 2),
        ('Майонез', 3),
        ('BBQ', 4)
    ) AS t(name, sort_order)
JOIN products p ON p.name = t.name
JOIN categories c ON c.id = p.category_id AND c.name = 'Соуси'
JOIN product_variants v ON v.product_id = p.id AND v.label = 'порція'
JOIN option_groups g ON g.name = 'Соус до картоплі'
WHERE ogi.variant_id = v.id
  AND ogi.group_id = g.id;

COMMIT;
