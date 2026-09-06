-- update_free_sauces.sql
-- Разовий апдейт каталогу для БД, засіяної ДО появи безкоштовної квоти.
--
-- Для чистої бази не потрібен: seed_catalog.sql уже містить ці значення.
-- Тут — щоб не перезаливати каталог на робочій базі: повторний сид вимагав би
-- спершу очистити кошики (cart_items тримає variant_id через ON DELETE RESTRICT).
--
-- Застосовувати ПІСЛЯ 0002_free_options.sql. Ідемпотентний: повторний запуск
-- нічого не зіпсує.
--
-- Що робить:
--   1. Соуси до картоплі стають платними — 20 грн за порцію
--   2. Дозволяє до 5 порцій, перша безкоштовна
--   3. Виправляє ціну «Медової груші» на розмірі M: 329 -> 429.
--      Ціни піц однакові для всіх позицій одного розміру — це позиція бізнесу,
--      тож 329 на сайті це одрук.

BEGIN;

-- 1. Ціна порції соусу до картоплі
UPDATE option_group_items ogi
SET price_delta = 20
FROM option_groups g
WHERE g.id = ogi.group_id
  AND g.name = 'Соус до картоплі';

-- 2. Межі й квота для всіх товарів, що використовують цю групу
UPDATE product_option_groups pog
SET max_select = 5,
    free_count = 1
FROM option_groups g
WHERE g.id = pog.group_id
  AND g.name = 'Соус до картоплі';

-- 3. Ціна «Медової груші» на розмірі M
UPDATE product_variants v
SET price = 429
FROM products p
WHERE p.id = v.product_id
  AND p.name = 'Медова груша'
  AND v.label = 'M'
  AND v.price <> 429;

COMMIT;
