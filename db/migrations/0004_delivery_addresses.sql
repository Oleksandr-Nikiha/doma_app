-- 0004_delivery_addresses.sql
-- Довідник адрес доставки та адресний стоп-лист для м. Київ.

CREATE TABLE IF NOT EXISTS delivery_addresses (
    id          SERIAL PRIMARY KEY,
    city        VARCHAR(100) NOT NULL DEFAULT 'Київ',
    street      VARCHAR(255) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    notes       TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_delivery_addresses_city_street UNIQUE (city, street)
);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_city_active ON delivery_addresses(city, is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_street ON delivery_addresses(street);

-- Стартовий набір вулиць м. Київ (пілот: Поділ, Печерськ, Центр, Шевченківський)
INSERT INTO delivery_addresses (city, street, is_active, sort_order)
VALUES
    ('Київ', 'вул. Петра Сагайдачного', true, 10),
    ('Київ', 'вул. Набережна', true, 20),
    ('Київ', 'вул. Набережно-Хрещатицька', true, 30),
    ('Київ', 'вул. Велика Васильківська', true, 40),
    ('Київ', 'вул. Ярославів Вал', true, 50),
    ('Київ', 'вул. Хрещатик', true, 60),
    ('Київ', 'вул. Володимирська', true, 70),
    ('Київ', 'вул. Богдана Хмельницького', true, 80),
    ('Київ', 'вул. Басейна', true, 90),
    ('Київ', 'вул. Шота Руставелі', true, 100),
    ('Київ', 'вул. Еспланадна', true, 110),
    ('Київ', 'вул. Саксаганського', true, 120),
    ('Київ', 'вул. Жилянська', true, 130),
    ('Київ', 'вул. Антоновича', true, 140),
    ('Київ', 'вул. Шовковична', true, 150),
    ('Київ', 'вул. Лютеранська', true, 160),
    ('Київ', 'вул. Інститутська', true, 170),
    ('Київ', 'вул. Городецького', true, 180),
    ('Київ', 'вул. Мечникова', true, 190),
    ('Київ', 'вул. Леоніда Первомайського', true, 200),
    ('Київ', 'бул. Лесі Українки', true, 210),
    ('Київ', 'бул. Тараса Шевченка', true, 220),
    ('Київ', 'вул. Нижній Вал', true, 230),
    ('Київ', 'вул. Верхній Вал', true, 240),
    ('Київ', 'вул. Андріївський узвіз', true, 250),
    ('Київ', 'вул. Костянтинівська', true, 260),
    ('Київ', 'вул. Межигірська', true, 270),
    ('Київ', 'вул. Спаська', true, 280),
    ('Київ', 'вул. Хорива', true, 290),
    ('Київ', 'вул. Волоська', true, 300),
    ('Київ', 'вул. Почайнинська', true, 310)
ON CONFLICT (city, street) DO NOTHING;


