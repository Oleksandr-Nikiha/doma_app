-- 0001_core_schema.sql
-- Базова схема: користувачі, заклади, каталог (категорії/товари/варіанти),
-- групи опцій, кошики та налаштування доставки.

-- 1. Заклади
CREATE TABLE IF NOT EXISTS locations (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,              -- "Doma Pizza", "Doma Croissants"
    address             TEXT NOT NULL,
    phones              TEXT[] NOT NULL DEFAULT '{}',
    is_delivery_enabled BOOLEAN NOT NULL DEFAULT true,
    delivery_start_time TIME NOT NULL DEFAULT '10:30',
    delivery_end_time   TIME NOT NULL DEFAULT '21:30',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Користувачі
CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    telegram_id         BIGINT NOT NULL UNIQUE,
    full_name           TEXT NOT NULL,
    first_name          TEXT,
    last_name           TEXT,
    phone               TEXT NOT NULL,
    delivery_address    TEXT,
    additional_address  TEXT,
    is_phone_verified   BOOLEAN NOT NULL DEFAULT false,
    is_blocked          BOOLEAN NOT NULL DEFAULT false,
    admin_note          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_phone_verified ON users(is_phone_verified);

-- 3. Дерево категорій
CREATE TABLE IF NOT EXISTS categories (
    id           SERIAL PRIMARY KEY,
    location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    parent_id    INTEGER NULL REFERENCES categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    icon         TEXT,
    is_visible   BOOLEAN NOT NULL DEFAULT true,
    sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_location ON categories(location_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_listing ON categories(location_id, is_visible, sort_order);

-- 4. Товари
CREATE TABLE IF NOT EXISTS products (
    id            SERIAL PRIMARY KEY,
    category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    image_url     TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_available  BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_listing ON products(category_id, is_available, sort_order);

-- 5. Варіанти товарів (розміри / порції)
CREATE TABLE IF NOT EXISTS product_variants (
    id           SERIAL PRIMARY KEY,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,             -- "S", "M", "XL", "3XL", "порція", "1 шт."
    weight       TEXT,                      -- "550 г", опційно
    price        NUMERIC(10, 2) NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_sort ON product_variants(product_id, is_available, sort_order);

-- 6. Групи опцій / модифікаторів
CREATE TABLE IF NOT EXISTS option_groups (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

-- 7. Позиції всередині груп опцій
CREATE TABLE IF NOT EXISTS option_group_items (
    group_id     INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    price_delta  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (group_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_option_group_items_variant ON option_group_items(variant_id);

-- 8. Зв'язок товарів із групами опцій
CREATE TABLE IF NOT EXISTS product_option_groups (
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    group_id    INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE RESTRICT,
    min_select  INTEGER NOT NULL DEFAULT 1,
    max_select  INTEGER NOT NULL DEFAULT 1,
    free_count  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, group_id),
    CHECK (min_select >= 0 AND max_select >= min_select),
    CHECK (free_count >= 0 AND free_count <= max_select)
);

CREATE INDEX IF NOT EXISTS idx_product_option_groups_group ON product_option_groups(group_id);

-- 9. Кошики
CREATE TABLE IF NOT EXISTS carts (
    id           SERIAL PRIMARY KEY,
    telegram_id  BIGINT NOT NULL UNIQUE REFERENCES users(telegram_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Позиції кошика
CREATE TABLE IF NOT EXISTS cart_items (
    id           SERIAL PRIMARY KEY,
    cart_id      INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    qty          INTEGER NOT NULL CHECK (qty > 0),
    options_key  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, variant_id, options_key)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);

-- 11. Опції вибраної позиції кошика
CREATE TABLE IF NOT EXISTS cart_item_options (
    cart_item_id INTEGER NOT NULL REFERENCES cart_items(id) ON DELETE CASCADE,
    group_id     INTEGER NOT NULL,
    variant_id   INTEGER NOT NULL,
    qty          INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    PRIMARY KEY (cart_item_id, group_id, variant_id),
    FOREIGN KEY (group_id, variant_id) REFERENCES option_group_items(group_id, variant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cart_item_options_group_variant ON cart_item_options(group_id, variant_id);

