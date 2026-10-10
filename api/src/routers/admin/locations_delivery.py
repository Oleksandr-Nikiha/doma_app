import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    LocationDeliveryAdminOut,
    LocationDeliveryUpdateIn,
)

router = APIRouter()

@router.get("/locations/delivery", response_model=list[LocationDeliveryAdminOut])
async def list_admin_locations_delivery(
    staff: asyncpg.Record = Depends(get_current_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Отримує статус доставки та робочі години для закладів.
    Адміністратор бачить усі заклади, менеджер — лише свій (або всі, якщо не закріплений).
    """
    async with pool.acquire() as conn:
        if staff["role"] == "admin" or staff["location_id"] is None:
            rows = await conn.fetch(
                """
                SELECT id, name, address, is_delivery_enabled,
                       to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
                       to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
                FROM locations
                ORDER BY id
                """
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, name, address, is_delivery_enabled,
                       to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
                       to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
                FROM locations
                WHERE id = $1
                ORDER BY id
                """,
                staff["location_id"],
            )
    return [LocationDeliveryAdminOut(**dict(r)) for r in rows]


@router.patch("/locations/{location_id}/delivery", response_model=LocationDeliveryAdminOut)
async def update_location_delivery(
    location_id: int,
    payload: LocationDeliveryUpdateIn,
    staff: asyncpg.Record = Depends(get_current_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Оновлює налаштування доставки закладу:
    - аварійне вимкнення доставки при високому навантаженні
    - години роботи доставки (початок і кінець)
    """
    if staff["role"] != "admin" and staff["location_id"] != location_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас немає прав для керування доставкою цього закладу",
        )

    updates = []
    values = []
    idx = 1

    if payload.is_delivery_enabled is not None:
        updates.append(f"is_delivery_enabled = ${idx}")
        values.append(payload.is_delivery_enabled)
        idx += 1

    if payload.delivery_start_time is not None:
        updates.append(f"delivery_start_time = ${idx}::time")
        values.append(payload.delivery_start_time)
        idx += 1

    if payload.delivery_end_time is not None:
        updates.append(f"delivery_end_time = ${idx}::time")
        values.append(payload.delivery_end_time)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="Не вказано жодних змін")

    values.append(location_id)
    update_sql = f"""
        UPDATE locations
        SET {", ".join(updates)}
        WHERE id = ${idx}
        RETURNING id, name, address, is_delivery_enabled,
                  to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
                  to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(update_sql, *values)
        if not row:
            raise HTTPException(status_code=404, detail="Заклад не знайдено")

    return LocationDeliveryAdminOut(**dict(row))
