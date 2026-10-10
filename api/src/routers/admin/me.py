import asyncpg
from fastapi import APIRouter, Depends

from src.auth.deps import get_current_user
from src.db.connection import get_pool
from src.schemas.admin import AdminMeOut

router = APIRouter()

@router.get("/me", response_model=AdminMeOut)
async def get_admin_me(
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Перевіряє, чи є користувач співробітником (адмін або менеджер).
    Не кидає 403, щоб профіль клієнта міг тихо дізнатися, чи показувати кнопку адмінки.
    """
    async with pool.acquire() as conn:
        staff_row = await conn.fetchrow(
            """
            SELECT m.role, m.location_id, l.name AS location_name
            FROM managers m
            LEFT JOIN locations l ON l.id = m.location_id
            WHERE m.telegram_id = $1 AND m.is_active = true
            """,
            user["telegram_id"],
        )

    if not staff_row:
        return AdminMeOut(is_staff=False)

    return AdminMeOut(
        is_staff=True,
        role=staff_row["role"],
        location_id=staff_row["location_id"],
        location_name=staff_row["location_name"],
    )
