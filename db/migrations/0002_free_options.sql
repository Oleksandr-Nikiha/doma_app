-- 0002_free_options.sql
-- 1. Безкоштовна квота в групі опцій: «перший соус безкоштовно, наступні по 20».
-- 2. Прибирання двох індексів, що дублюють первинні ключі.

-- --- Безкоштовна квота ---
--
-- Живе на звʼязку товар↔група, а не на самій групі — з тієї ж причини, що й
-- min_select/max_select: знижка це властивість того, ЯК конкретний товар
-- використовує групу. Бокс дає один безкоштовний соус, майбутній великий сет
-- міг би давати два, а група при цьому та сама.
--
-- 0 за замовчуванням — усі наявні звʼязки лишаються платними як були.
ALTER TABLE product_option_groups
    ADD COLUMN IF NOT EXISTS free_count INTEGER NOT NULL DEFAULT 0;

-- Окремим кроком, бо ADD COLUMN ... CHECK не можна зробити ідемпотентним
-- через IF NOT EXISTS: обмеження додається за іменем.
ALTER TABLE product_option_groups
    DROP CONSTRAINT IF EXISTS product_option_groups_free_count_check;

ALTER TABLE product_option_groups
    ADD CONSTRAINT product_option_groups_free_count_check
    CHECK (free_count >= 0 AND free_count <= max_select);

-- --- Надлишкові індекси ---
--
-- Postgres під первинним ключем уже створює унікальний btree, тож обидва
-- нижче дублюють його побайтово. Користі нуль, а платимо за них на кожному
-- INSERT і місцем на диску.
--
--   cart_item_options_pkey     (cart_item_id, group_id, variant_id)
--     → idx_cart_item_options_cart_item (cart_item_id) — префікс ключа
--   product_option_groups_pkey (product_id, group_id)
--     → idx_product_option_groups_product (product_id, group_id) — те саме
--
-- idx_cart_item_options_group_variant НЕ чіпаємо: (group_id, variant_id)
-- префіксом ключа не є, а за ним ходить перевірка зовнішнього ключа при
-- видаленні з option_group_items.
DROP INDEX IF EXISTS idx_cart_item_options_cart_item;
DROP INDEX IF EXISTS idx_product_option_groups_product;
