-- scripts/reset_keep_users.sql
-- Очищення бази даних doma_app зі збереженням таблиць users та managers.
-- Видаляє всі інші таблиці (кошики, замовлення, каталог, адреси, сесії, історію міграцій).
-- Можна виконати через psql або pgAdmin:
--     psql "$DATABASE_URL" -f scripts/reset_keep_users.sql

BEGIN;

-- 1. Скидаємо прив'язку локацій у менеджерів, оскільки таблицю locations буде перестворено
UPDATE managers SET location_id = NULL;

-- 2. Видаляємо всі таблиці схеми public, крім users та managers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT IN ('users', 'managers')
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

COMMIT;
