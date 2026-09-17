-- 0008_sushi_addons.sql
-- Додавання додатків «Васабі» та «Імбир» до всіх позицій суші:
-- 1. Звичайні роли: по 1 безкоштовно (free_count = 1), до 5 максимум (max_select = 5), 20 грн за порцію понад квоту.
-- 2. Сети з ролів: по 2 безкоштовно (free_count = 2), до 5 максимум (max_select = 5), 20 грн за порцію понад квоту.

-- 1. Створення товарів «Васабі» та «Імбир» у прихованій категорії «Соуси»
INSERT INTO products (category_id, name, description, image_url, sort_order)
SELECT c.id, 'Васабі', NULL, NULL, 8
FROM categories c
JOIN locations l ON l.id = c.location_id
WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
  AND NOT EXISTS (
      SELECT 1 FROM products p WHERE p.category_id = c.id AND p.name = 'Васабі'
  );

INSERT INTO products (category_id, name, description, image_url, sort_order)
SELECT c.id, 'Імбир', NULL, NULL, 9
FROM categories c
JOIN locations l ON l.id = c.location_id
WHERE l.name = 'Doma Pizza' AND c.parent_id IS NULL AND c.name = 'Соуси'
  AND NOT EXISTS (
      SELECT 1 FROM products p WHERE p.category_id = c.id AND p.name = 'Імбир'
  );

-- 2. Варіанти «порція» для кожного товару (базова ціна 20 грн)
INSERT INTO product_variants (product_id, label, weight, price, sort_order)
SELECT p.id, 'порція', NULL, 20, 1
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.name = 'Соуси' AND p.name IN ('Васабі', 'Імбир')
  AND NOT EXISTS (
      SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.label = 'порція'
  );

-- 3. Створення груп опцій «Васабі» та «Імбир»
INSERT INTO option_groups (name, sort_order)
SELECT 'Васабі', 4
WHERE NOT EXISTS (SELECT 1 FROM option_groups WHERE name = 'Васабі');

INSERT INTO option_groups (name, sort_order)
SELECT 'Імбир', 5
WHERE NOT EXISTS (SELECT 1 FROM option_groups WHERE name = 'Імбир');

-- 4. Елементи груп опцій (price_delta = 20)
INSERT INTO option_group_items (group_id, variant_id, price_delta, sort_order)
SELECT g.id, v.id, 20, 1
FROM option_groups g, product_variants v
JOIN products p ON p.id = v.product_id
JOIN categories c ON c.id = p.category_id
WHERE g.name = 'Васабі' AND p.name = 'Васабі' AND v.label = 'порція' AND c.name = 'Соуси'
  AND NOT EXISTS (
      SELECT 1 FROM option_group_items WHERE group_id = g.id AND variant_id = v.id
  );

INSERT INTO option_group_items (group_id, variant_id, price_delta, sort_order)
SELECT g.id, v.id, 20, 1
FROM option_groups g, product_variants v
JOIN products p ON p.id = v.product_id
JOIN categories c ON c.id = p.category_id
WHERE g.name = 'Імбир' AND p.name = 'Імбир' AND v.label = 'порція' AND c.name = 'Соуси'
  AND NOT EXISTS (
      SELECT 1 FROM option_group_items WHERE group_id = g.id AND variant_id = v.id
  );

-- 5. Прив'язка груп опцій до звичайних ролів (підкатегорії під «Суші та роли», крім «Сети з ролів»)
-- min_select = 0, max_select = 5, free_count = 1
INSERT INTO product_option_groups (product_id, group_id, min_select, max_select, free_count, sort_order)
SELECT p.id, g.id, 0, 5, 1, CASE WHEN g.name = 'Васабі' THEN 1 ELSE 2 END
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN categories parent ON parent.id = c.parent_id
CROSS JOIN option_groups g
WHERE parent.name = 'Суші та роли'
  AND c.name <> 'Сети з ролів'
  AND g.name IN ('Васабі', 'Імбир')
ON CONFLICT (product_id, group_id) DO UPDATE
SET min_select = EXCLUDED.min_select,
    max_select = EXCLUDED.max_select,
    free_count = EXCLUDED.free_count,
    sort_order = EXCLUDED.sort_order;

-- 6. Прив'язка груп опцій до сетів ролів (підкатегорія «Сети з ролів»)
-- min_select = 0, max_select = 5, free_count = 2
INSERT INTO product_option_groups (product_id, group_id, min_select, max_select, free_count, sort_order)
SELECT p.id, g.id, 0, 5, 2, CASE WHEN g.name = 'Васабі' THEN 1 ELSE 2 END
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN categories parent ON parent.id = c.parent_id
CROSS JOIN option_groups g
WHERE parent.name = 'Суші та роли'
  AND c.name = 'Сети з ролів'
  AND g.name IN ('Васабі', 'Імбир')
ON CONFLICT (product_id, group_id) DO UPDATE
SET min_select = EXCLUDED.min_select,
    max_select = EXCLUDED.max_select,
    free_count = EXCLUDED.free_count,
    sort_order = EXCLUDED.sort_order;

