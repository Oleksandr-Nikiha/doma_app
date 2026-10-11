#!/usr/bin/env python3
"""
Скрипт призначення / створення головного адміністратора системи на прод-сервері.
Використання:
    python3 scripts/create_admin.py <TELEGRAM_ID> [ПОВНЕ_ІМ'Я]
Приклад:
    python3 scripts/create_admin.py 123456789 "Олександр (Admin)"
    або через Docker:
    docker compose exec -T api python scripts/create_admin.py 123456789
"""

import asyncio
import os
import sys
from pathlib import Path

import asyncpg


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")

    raise RuntimeError("DATABASE_URL не знайдено в оточенні чи у файлі .env")


async def main():
    if len(sys.argv) < 2:
        print("❌ Помилка: вкажіть telegram_id користувача.")
        print("Використання: python3 scripts/create_admin.py <TELEGRAM_ID> [ПОВНЕ_ІМ'Я]")
        sys.exit(1)

    try:
        telegram_id = int(sys.argv[1])
    except ValueError:
        print(f"❌ Помилка: '{sys.argv[1]}' не є числом (валідне telegram_id).")
        sys.exit(1)

    full_name = sys.argv[2] if len(sys.argv) > 2 else "Головний Адміністратор"

    db_url = get_database_url()
    conn = await asyncpg.connect(db_url)
    try:
        async with conn.transaction():
            # 1. Створюємо або оновлюємо запис у таблиці users
            await conn.execute(
                """
                INSERT INTO users (telegram_id, full_name, phone, delivery_address)
                VALUES ($1, $2, '+380000000000', 'Адміністрація')
                ON CONFLICT (telegram_id) DO UPDATE
                SET full_name = EXCLUDED.full_name,
                    updated_at = now();
                """,
                telegram_id,
                full_name,
            )

            # 2. Створюємо або оновлюємо запис у managers
            await conn.execute(
                """
                INSERT INTO managers (telegram_id, role, location_id, is_active)
                VALUES ($1, 'admin', NULL, true)
                ON CONFLICT (telegram_id) DO UPDATE
                SET role = 'admin',
                    is_active = true,
                    updated_at = now();
                """,
                telegram_id,
            )

        print(f"✅ Користувача {full_name} (telegram_id: {telegram_id}) успішно призначено Адміністратором (роль: admin)!")
        print("Тепер цей акаунт має повний доступ до адмін-панелі /admin.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

