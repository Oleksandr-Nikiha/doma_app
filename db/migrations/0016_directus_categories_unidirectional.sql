-- 0016_directus_categories_unidirectional.sql
-- Оптимізація моделі категорій у Directus:
-- 1. Додавання перевірки на рівні БД, що категорія не може бути батьківською для самої себе.
-- 2. Перетворення зв'язку parent_id на односпрямований (unidirectional Many-to-One):
--    видалення зворотного O2M поля subcategories у Directus, що усуває рекурсивні вкладення в UI.
-- 3. Налаштування фільтра для parent_id: у випадаючому списку дозволено обирати лише кореневі категорії (parent_id IS NULL),
--    що автоматично обмежує глибину дерева до зрозумілих 2-х рівнів (Категорія -> Підкатегорія).

BEGIN;

-- 1. Обмеження на рівні PostgreSQL: категорія не може посилатися сама на себе
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_categories_parent_not_self'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT chk_categories_parent_not_self
            CHECK (parent_id IS NULL OR parent_id <> id);
    END IF;
END $$;

-- 2. Видалення зворотного O2M поля subcategories у Directus
-- Занулення one_field робить зв'язок M2O односпрямованим і ховає рекурсивний список підкатегорій з форми
UPDATE directus_relations
SET one_field = NULL
WHERE many_collection = 'categories' AND many_field = 'parent_id';

-- Якщо поле subcategories було зафіксоване в метаданих directus_fields, видаляємо його
DELETE FROM directus_fields
WHERE collection = 'categories' AND field = 'subcategories';

-- 3. Налаштування інтерфейсу вибору parent_id у Directus:
-- Дозволяємо вибирати тільки категорії верхнього рівня (де parent_id IS NULL)
UPDATE directus_fields
SET
    interface = 'select-dropdown-m2o',
    display = 'related-values',
    display_options = '{"template": "{{name}}"}'::jsonb,
    options = '{"template": "{{name}}", "filter": {"parent_id": {"_null": true}}}'::jsonb,
    note = 'Батьківська категорія (залиште порожнім для кореневої)'
WHERE collection = 'categories' AND field = 'parent_id';

COMMIT;
