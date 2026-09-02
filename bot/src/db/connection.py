import asyncpg

from src.config import get_settings

_pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    """Створює пул з'єднань при старті бота."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=5,
    )


async def disconnect_db() -> None:
    """Закриває пул при зупинці бота."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError(
            "DB pool ще не ініціалізовано — connect_db() має викликатись до старту polling."
        )
    return _pool


async def get_user_by_telegram_id(telegram_id: int) -> asyncpg.Record | None:
    """
    Профіль користувача або None, якщо він ще не проходив реєстрацію в Mini App.
    Бот сам нікого не реєструє — це робить `POST /api/register`.
    """
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(
            "SELECT id, telegram_id, full_name, phone, delivery_address "
            "FROM users WHERE telegram_id = $1",
            telegram_id,
        )
