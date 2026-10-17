import asyncpg
from fastapi import APIRouter, Depends, Query

from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.delivery_address import DeliveryAddressOut

router = APIRouter(
    prefix="/api/delivery",
    tags=["delivery"],
    dependencies=[Depends(rate_limiter)],
)


@router.get("/cities", response_model=list[str])
async def list_delivery_cities(pool: asyncpg.Pool = Depends(get_pool)):
    """
    Список доступних населених пунктів для доставки.
    Публічний ендпоінт.
    """
    rows = await pool.fetch(
        """
        SELECT DISTINCT city
        FROM delivery_addresses
        WHERE is_active = true
        ORDER BY city
        """
    )
    # Якщо таблиця порожня, повертаємо дефолтний Київ
    cities = [r["city"] for r in rows]
    return cities if cities else ["Київ"]


@router.get("/addresses", response_model=list[DeliveryAddressOut])
async def list_active_delivery_addresses(
    city: str = Query(default="Київ", description="Населений пункт"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Список доступних вулиць/адрес для обраного населеного пункту.
    Повертає лише активні адреси (ті, що не в стоплисті).
    """
    rows = await pool.fetch(
        """
        SELECT id, city, street
        FROM delivery_addresses
        WHERE lower(city) = lower($1) AND is_active = true
        ORDER BY sort_order ASC, street ASC
        """,
        city.strip(),
    )
    return [DeliveryAddressOut(**dict(r)) for r in rows]
