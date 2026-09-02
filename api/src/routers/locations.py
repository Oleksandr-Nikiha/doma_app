import asyncpg
from fastapi import APIRouter, Depends

from src.db.connection import get_pool
from src.schemas.location import LocationOut

router = APIRouter(prefix="/api", tags=["locations"])


@router.get("/locations", response_model=list[LocationOut])
async def list_locations(pool: asyncpg.Pool = Depends(get_pool)):
    """
    Список закладів для вкладки «Контакти».
    Публічний ендпоінт — не потребує initData, бо контакти доступні всім.
    """
    rows = await pool.fetch(
        "SELECT id, name, address, phones FROM locations ORDER BY id"
    )
    return [LocationOut(**dict(row)) for row in rows]
