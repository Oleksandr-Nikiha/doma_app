import asyncpg
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from src.auth.admin_token import verify_admin_token
from src.auth.telegram_init_data import validate_init_data
from src.config import get_settings
from src.db.connection import get_pool

init_data_header = APIKeyHeader(
    name="X-Telegram-Init-Data",
    scheme_name="TelegramInitData",
    description=(
        "Рядок Telegram.WebApp.initData. Для локального тестування "
        "згенеруйте його: python3 scripts/generate_test_init_data.py $BOT_TOKEN"
    ),
    auto_error=False,
)

admin_token_header = APIKeyHeader(
    name="X-Admin-Token",
    scheme_name="AdminToken",
    description="Токен адміністратора для доступу з комп'ютера",
    auto_error=False,
)


async def get_init_data(
    init_data_raw: str | None = Depends(init_data_header), settings=Depends(get_settings)
) -> dict:
    """
    Дістає заголовок X-Telegram-Init-Data, валідує його
    та повертає розпарсений словник із даними.
    """
    if not init_data_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Відсутній заголовок X-Telegram-Init-Data",
        )

    try:
        return validate_init_data(init_data=init_data_raw, bot_token=settings.bot_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Помилка авторизації: {e}"
        ) from e


async def get_current_user(
    init_data_raw: str | None = Depends(init_data_header),
    admin_token_raw: str | None = Depends(admin_token_header),
    settings=Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Авторизує користувача через X-Admin-Token або X-Telegram-Init-Data.
    Повертає запис користувача з бази даних.
    """
    telegram_id: int | None = None

    if admin_token_raw:
        telegram_id = verify_admin_token(admin_token_raw, settings.bot_token)
        if not telegram_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недійсний або прострочений токен адміністратора (X-Admin-Token)",
            )
    elif init_data_raw:
        try:
            init_data = validate_init_data(init_data=init_data_raw, bot_token=settings.bot_token)
            user_data = init_data.get("user", {})
            telegram_id = user_data.get("id")
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Помилка авторизації: {e}"
            ) from e
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Відсутній заголовок авторизації (X-Telegram-Init-Data або X-Admin-Token)",
        )

    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не вдалося отримати telegram_id з даних авторизації",
        )

    async with pool.acquire() as conn:
        user_row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Користувача не зареєстровано"
        )

    return user_row


async def get_current_staff(
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
) -> asyncpg.Record:
    """
    Перевіряє, чи є користувач активним менеджером або адміністратором.
    Повертає запис зі штату з полями role, location_id, is_active тощо.
    """
    async with pool.acquire() as conn:
        staff_row = await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, m.role, m.location_id, m.is_active,
                   l.name AS location_name, u.full_name, u.phone
            FROM managers m
            JOIN users u ON u.telegram_id = m.telegram_id
            LEFT JOIN locations l ON l.id = m.location_id
            WHERE m.telegram_id = $1 AND m.is_active = true
            """,
            user["telegram_id"],
        )

    if not staff_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ заборонено. Тільки для персоналу закладу.",
        )

    return staff_row


async def get_current_admin(
    staff: asyncpg.Record = Depends(get_current_staff),
) -> asyncpg.Record:
    """
    Перевіряє, чи має користувач найвищу роль 'admin'.
    """
    if staff["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ заборонено. Потрібні права головного адміністратора.",
        )

    return staff
