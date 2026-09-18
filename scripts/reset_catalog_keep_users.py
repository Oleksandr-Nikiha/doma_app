#!/usr/bin/env python3
"""
Скрипт для очищення бази даних doma_app зі збереженням таблиць користувачів та менеджерів.

Видаляє всі таблиці схем public (кошики, замовлення, каталог, адреси, сесії, історію міграцій),
КРІМ:
  - users
  - managers

Після виконання база готова до застосування оновлених міграцій (scripts/migrate.py)
та запуску сиду (db/seed/seed_catalog.sql).

Використання:
    python3 scripts/reset_catalog_keep_users.py
    python3 scripts/reset_catalog_keep_users.py --force
    python3 scripts/reset_catalog_keep_users.py --force --migrate --seed
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

import asyncpg

from scripts.migrate import get_database_url, run_migrations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("reset_db")

KEEP_TABLES = {"users", "managers"}


async def reset_database(force: bool = False) -> None:
    db_url = get_database_url()

    logger.info("Підключення до бази даних...")
    conn = await asyncpg.connect(db_url)
    try:
        # Отримуємо перелік усіх наявних таблиць у схемі public
        rows = await conn.fetch(
            """
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
            """
        )
        all_tables = [r["tablename"] for r in rows]
        tables_to_drop = [t for t in all_tables if t not in KEEP_TABLES]
        tables_to_keep = [t for t in all_tables if t in KEEP_TABLES]

        logger.info("Знайдено таблиць у базі: %d", len(all_tables))
        logger.info(
            "Таблиці, що залишаються недоторканими: %s",
            ", ".join(tables_to_keep) or "немає",
        )
        logger.info(
            "Таблиці, що БУДУТЬ ВИДАЛЕНІ (%d): %s",
            len(tables_to_drop),
            ", ".join(tables_to_drop) or "немає",
        )

        if not tables_to_drop:
            logger.info("Немає таблиць для видалення.")
            return

        if not force:
            prompt = "\n⚠️ Ви впевнені, що бажаєте видалити зазначені таблиці? [y/N]: "
            confirm = input(prompt).strip().lower()
            if confirm not in ("y", "yes", "так"):
                logger.info("Операцію скасовано користувачем.")
                sys.exit(0)

        logger.info("⏳ Очищення таблиць...")
        async with conn.transaction():
            # 1. Скидаємо location_id у менеджерів, оскільки таблицю locations буде видалено
            has_managers = await conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1 FROM pg_tables 
                    WHERE schemaname = 'public' AND tablename = 'managers'
                )
                """
            )
            if has_managers:
                await conn.execute("UPDATE managers SET location_id = NULL;")
                logger.info("• Скинуто location_id = NULL у таблиці managers")

            # 2. Каскадно видаляємо всі інші таблиці
            for table in tables_to_drop:
                await conn.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
                logger.info("  ✕ Видалено таблицю: %s", table)

        logger.info("✅ Очищення завершено! Таблиці users та managers збережено.")

    finally:
        await conn.close()


async def apply_seed() -> None:
    db_url = get_database_url()
    project_root = Path(__file__).resolve().parent.parent
    seed_file = project_root / "db" / "seed" / "seed_catalog.sql"

    if not seed_file.exists():
        logger.error("Файл сиду %s не знайдено", seed_file)
        sys.exit(1)

    logger.info("⏳ Застосування сиду з %s...", seed_file.name)
    conn = await asyncpg.connect(db_url)
    try:
        sql = seed_file.read_text(encoding="utf-8")
        await conn.execute(sql)
        logger.info("✅ Сід %s успішно виконано!", seed_file.name)
    finally:
        await conn.close()


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Очищення бази даних doma_app зі збереженням таблиць users і managers."
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Пропустити інтерактивне підтвердження",
    )
    parser.add_argument(
        "--migrate",
        "-m",
        action="store_true",
        help="Одразу автоматично застосувати міграції після очищення",
    )
    parser.add_argument(
        "--seed",
        "-s",
        action="store_true",
        help="Одразу автоматично застосувати seed_catalog.sql після міграцій",
    )

    args = parser.parse_args()

    await reset_database(force=args.force)

    if args.migrate:
        logger.info("\n--- Запуск міграцій ---")
        await run_migrations()

    if args.seed:
        if not args.migrate:
            logger.warning(
                "Увага: --seed викликано без --migrate. "
                "Переконайтеся, що міграції застосовані."
            )
        logger.info("\n--- Запуск сиду ---")
        await apply_seed()

    if not args.migrate and not args.seed:
        logger.info("\nТепер ви можете виконати:")
        logger.info("  1. python3 scripts/migrate.py")
        logger.info("  2. psql \"$DATABASE_URL\" -f db/seed/seed_catalog.sql")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nПерервано.")
        sys.exit(0)
    except Exception as e:
        logger.error("❌ Помилка: %s", e)
        sys.exit(1)
