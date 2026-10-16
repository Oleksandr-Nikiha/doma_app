-- 0016_directus_categories_unidirectional.sql
-- Directus CMS видалено. Залишено перевірку на рівні БД, що категорія не може посилатися сама на себе.

BEGIN;

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

COMMIT;
