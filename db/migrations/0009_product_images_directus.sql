-- 0009_product_images_directus.sql
-- Додавання поля image (UUID) для інтеграції з Directus File Storage
-- та тригера автоматичної синхронізації products.image_url

-- 1. Додаємо колонку image у products із зовнішнім ключем на directus_files(id)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image UUID REFERENCES directus_files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_image ON products(image);

-- 2. Функція та тригер для підтримки image_url у синхронізації з directus_files
CREATE OR REPLACE FUNCTION sync_product_image_url()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.image IS NOT NULL AND (NEW.image IS DISTINCT FROM OLD.image OR NEW.image_url IS NULL) THEN
        SELECT '/api/uploads/' || filename_disk INTO NEW.image_url
        FROM directus_files WHERE id = NEW.image;
    ELSIF NEW.image IS NULL AND OLD.image IS NOT NULL AND NEW.image_url LIKE '/api/uploads/%' THEN
        NEW.image_url := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_image_url ON products;
CREATE TRIGGER trg_sync_product_image_url
BEFORE INSERT OR UPDATE OF image ON products
FOR EACH ROW
EXECUTE FUNCTION sync_product_image_url();

-- 3. Реєстрація поля в Directus Metadata (directus_fields)
INSERT INTO directus_fields (
    collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, note, required
)
SELECT
    'products', 'image', 'file', 'file-image', NULL, 'image', NULL, false, false, 4, 'full', 'Зображення страви (файл Directus)', false
WHERE NOT EXISTS (
    SELECT 1 FROM directus_fields WHERE collection = 'products' AND field = 'image'
);

-- 4. Реєстрація зв'язку Many-to-One в Directus (directus_relations)
INSERT INTO directus_relations (
    many_collection, many_field, one_collection, one_field, one_deselect_action
)
SELECT
    'products', 'image', 'directus_files', NULL, 'nullify'
WHERE NOT EXISTS (
    SELECT 1 FROM directus_relations WHERE many_collection = 'products' AND many_field = 'image'
);

-- 5. Дозволяємо публічне читання directus_files у Directus
INSERT INTO directus_permissions (policy, collection, action, permissions, validation, fields)
SELECT p.id, 'directus_files', 'read', '{}', '{}', '*'
FROM directus_policies p
WHERE p.name = '$t:public_label'
AND NOT EXISTS (
    SELECT 1 FROM directus_permissions perm
    WHERE perm.policy = p.id AND perm.collection = 'directus_files' AND perm.action = 'read'
);

