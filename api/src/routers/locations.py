import asyncpg
from fastapi import APIRouter, Depends, Header, Query

from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.location import LocationOut
from src.services.cache import get_cached_json, set_cached_json

router = APIRouter(prefix="/api", tags=["locations"], dependencies=[Depends(rate_limiter)])


@router.get("/locations", response_model=list[LocationOut])
async def list_locations(
    bypass_cache: bool = Query(False, description="Отримати свіжі дані повз кеш"),
    x_bypass_cache: str | None = Header(None, alias="X-Bypass-Cache"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Список закладів для вкладки «Контакти».
    Публічний ендпоінт — не потребує initData, бо контакти доступні всім.
    """
    cache_key = "catalog:locations"
    should_bypass = bypass_cache or (x_bypass_cache in ("1", "true", "True"))

    if not should_bypass:
        cached = await get_cached_json(cache_key)
        if cached is not None:
            return [LocationOut(**item) for item in cached]

    rows = await pool.fetch(
        """
        SELECT id, name, address, phones,
               is_delivery_enabled,
               to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
               to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
        FROM locations
        ORDER BY id
        """
    )
    result = [LocationOut(**dict(row)) for row in rows]

    if not should_bypass:
        await set_cached_json(cache_key, [r.model_dump(mode="json") for r in result])

    return result
