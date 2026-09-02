import asyncpg
from fastapi import Depends, Header, HTTPException, status

from src.auth.telegram_init_data import validate_init_data
from src.config import get_settings
from src.db.connection import get_pool


async def get_init_data(
    x_telegram_init_data: str = Header(...),
    settings = Depends(get_settings)
) -> dict:
    """
    Дістає заголовок X-Telegram-Init-Data, валідує його 
    та повертає розпарсений словник із даними.
    """
    try:
        return validate_init_data(
            init_data=x_telegram_init_data,
            bot_token=settings.bot_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Помилка авторизації: {e}"
        ) from e


async def get_current_user(
    init_data: dict = Depends(get_init_data),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Використовує валідовані дані з get_init_data, шукає користувача 
    в базі даних за telegram_id і повертає рядок користувача.
    """
    user_data = init_data.get("user", {})
    telegram_id = user_data.get("id")

    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не вдалося отримати telegram_id з даних авторизації"
        )

    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT * FROM users WHERE telegram_id = $1", 
            telegram_id
        )

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Користувача не зареєстровано"
        )

    return user_row