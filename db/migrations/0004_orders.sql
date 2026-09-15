-- 0004_orders.sql
-- Таблиці для оформлення та збереження замовлень (Фаза 2: фізична оплата та модерація)

CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    telegram_id      BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE RESTRICT,
    status           TEXT NOT NULL DEFAULT 'pending_moderation'
                     CHECK (status IN ('pending_moderation', 'confirmed', 'rejected', 'in_progress', 'ready', 'completed', 'cancelled')),
    fulfillment_type TEXT NOT NULL
                     CHECK (fulfillment_type IN ('delivery', 'pickup')),
    delivery_address TEXT,
    contact_name     TEXT NOT NULL,
    contact_phone    TEXT NOT NULL,
    payment_method   TEXT NOT NULL
                     CHECK (payment_method IN ('cash', 'card')),
    comment          TEXT,
    total_price      NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_groups (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'cooking', 'ready', 'cancelled')),
    subtotal    NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    id             SERIAL PRIMARY KEY,
    order_group_id INTEGER NOT NULL REFERENCES order_groups(id) ON DELETE CASCADE,
    variant_id     INTEGER NULL REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name   TEXT NOT NULL,
    variant_label  TEXT NOT NULL,
    unit_price     NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    qty            INTEGER NOT NULL CHECK (qty > 0),
    subtotal       NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS order_item_options (
    id                SERIAL PRIMARY KEY,
    order_item_id     INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_group_name TEXT NOT NULL,
    option_name       TEXT NOT NULL,
    price_delta       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
    qty               INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0)
);

-- Індекси для оптимізації вибірок
CREATE INDEX IF NOT EXISTS idx_orders_telegram_id ON orders(telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_groups_order ON order_groups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_groups_location ON order_groups(location_id);
CREATE INDEX IF NOT EXISTS idx_order_items_group ON order_items(order_group_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_item ON order_item_options(order_item_id);

