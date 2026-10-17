-- 0019_users_bonus_balance.sql
-- Програма лояльності URBAN CLUB: баланс бонусних балів (1 бонус = 1 ₴)
-- За замовчуванням кожному користувачу нараховується 50 вітальних бонусів.

ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance INTEGER NOT NULL DEFAULT 50;

-- Оновлюємо існуючих користувачів, встановлюючи стартовий бонусний баланс
UPDATE users SET bonus_balance = 50 WHERE bonus_balance IS NULL OR bonus_balance = 0;
