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
GRANT USAGE, SELECT ON SEQUENCE product_option_groups_id_seq TO svc_urban_bites;
GRANT USAGE, SELECT ON SEQUENCE option_group_items_id_seq TO svc_urban_bites;

COMMIT;


