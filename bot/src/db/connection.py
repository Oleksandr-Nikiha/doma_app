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
            "SELECT id, telegram_id, full_name, phone, delivery_address, is_phone_verified "
            "FROM users WHERE telegram_id = $1",
            telegram_id,
        )


async def set_user_phone_verified(
    telegram_id: int, phone: str, full_name: str | None = None
) -> bool:
    """Оновлює або створює запис користувача з верифікованим номером телефону."""
    async with get_pool().acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE telegram_id = $1", telegram_id
        )
        if existing:
            await conn.execute(
                """
                UPDATE users
                SET phone = $1,
                    is_phone_verified = true,
                    updated_at = now()
                WHERE telegram_id = $2
                """,
                phone,
                telegram_id,
            )
        else:
            first_name = full_name.split(" ", 1)[0] if full_name else ""
            last_name = (
                full_name.split(" ", 1)[1]
                if full_name and len(full_name.split(" ", 1)) > 1
                else None
            )
            await conn.execute(
                """
                INSERT INTO users (
                    telegram_id, full_name, first_name, last_name, phone, is_phone_verified
                )
                VALUES ($1, $2, $3, $4, $5, true)
                """,
                telegram_id,
                full_name or "Користувач",
                first_name,
                last_name,
                phone,
            )
        return True


async def get_manager_by_telegram_id(telegram_id: int) -> asyncpg.Record | None:
    """Повертає профіль менеджера/адміністратора, якщо він активний."""
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, m.role, m.location_id, m.is_active,
                   u.full_name, u.phone
            FROM managers m
            JOIN users u ON u.telegram_id = m.telegram_id
            WHERE m.telegram_id = $1 AND m.is_active = true
            """,
            telegram_id,
        )


async def get_admin_session_by_id(session_id) -> asyncpg.Record | None:
    """Повертає сесію авторизації за UUID."""
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT id, code, telegram_id, token, status, expires_at
            FROM admin_auth_sessions
            WHERE id = $1
            """,
            session_id,
        )


async def get_admin_session_by_code(code: str) -> asyncpg.Record | None:
    """Повертає активну сесію авторизації за 6-значним кодом."""
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT id, code, telegram_id, token, status, expires_at 
            FROM admin_auth_sessions 
            WHERE code = $1 AND expires_at > NOW() AND status = 'pending'
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            code,
        )


async def approve_admin_session(session_id, telegram_id: int, token: str) -> bool:
    """Підтверджує сесію авторизації адміна."""
    async with get_pool().acquire() as conn:
        result = await conn.execute(
            """
            UPDATE admin_auth_sessions
            SET status = 'approved',
                telegram_id = $1,
                token = $2
            WHERE id = $3 AND status = 'pending' AND expires_at > NOW()
            """,
            telegram_id,
            token,
            session_id,
        )
        return result == "UPDATE 1"
