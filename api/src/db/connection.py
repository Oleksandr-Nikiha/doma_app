import asyncpg

from src.config import get_settings

_pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    """Викликається при старті FastAPI (lifespan). Створює пул з'єднань один раз."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
    )


async def disconnect_db() -> None:
    """Викликається при завершенні роботи застосунку."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """
    Повертає активний пул. Використовується у dependency-функціях роутерів,
    напр.: `pool = Depends(get_pool)`.
    """
    if _pool is None:
        raise RuntimeError(
            "DB pool ще не ініціалізовано — переконайся, що connect_db() "
            "викликається у lifespan застосунку до першого запиту."
        )
    return _pool