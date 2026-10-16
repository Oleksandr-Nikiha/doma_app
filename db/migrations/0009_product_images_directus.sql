-- 0009_product_images_directus.sql
-- Додавання поля image (UUID) для сумісності без жорсткої прив'язки до Directus
ALTER TABLE products ADD COLUMN IF NOT EXISTS image UUID;
CREATE INDEX IF NOT EXISTS idx_products_image ON products(image);
