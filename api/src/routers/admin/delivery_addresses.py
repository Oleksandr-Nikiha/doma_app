import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.delivery_address import (
    AdminDeliveryAddressOut,
    DeliveryAddressCreateIn,
    DeliveryAddressUpdateIn,
)

router = APIRouter()


@router.get("/delivery/addresses", response_model=list[AdminDeliveryAddressOut])
async def admin_list_delivery_addresses(
    city: str | None = Query(None, description="Фільтр за містом"),
    search: str | None = Query(None, description="Пошук за назвою вулиці"),
    is_active: bool | None = Query(None, description="Фільтр за активністю"),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """
    Отримання повного списку адрес (включаючи стоплист) для адмін-панелі.
    Доступно для адміністратора та менеджера.
    """
    query = """
        SELECT id, city, street, is_active, notes, sort_order, created_at, updated_at
        FROM delivery_addresses
        WHERE 1=1
    """
    params = []
    if city:
        params.append(city.strip())
        query += f" AND lower(city) = lower(${len(params)})"
    if search:
        params.append(f"%{search.strip()}%")
        query += f" AND street ILIKE ${len(params)}"
    if is_active is not None:
        params.append(is_active)
        query += f" AND is_active = ${len(params)}"

    query += " ORDER BY city ASC, sort_order ASC, street ASC"

    rows = await pool.fetch(query, *params)
    return [AdminDeliveryAddressOut(**dict(r)) for r in rows]


@router.post(
    "/delivery/addresses",
    response_model=AdminDeliveryAddressOut,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_delivery_address(
    data: DeliveryAddressCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Створення нової адреси/вулиці в довіднику."""
    clean_city = data.city.strip()
    clean_street = data.street.strip()
    clean_notes = data.notes.strip() if data.notes else None

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO delivery_addresses (city, street, is_active, notes, sort_order)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, city, street, is_active, notes, sort_order, created_at, updated_at
            """,
            clean_city,
            clean_street,
            data.is_active,
            clean_notes,
            data.sort_order,
        )
    except asyncpg.UniqueViolationError as err:
        raise HTTPException(
            status_code=400,
            detail=f"Адреса '{clean_street}' для міста '{clean_city}' вже існує",
        ) from err
    return AdminDeliveryAddressOut(**dict(row))


@router.patch("/delivery/addresses/{address_id}", response_model=AdminDeliveryAddressOut)
async def admin_update_delivery_address(
    address_id: int,
    data: DeliveryAddressUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення адреси або перемикання стоплиста."""
    updates = []
    params = [address_id]

    if data.city is not None:
        params.append(data.city.strip())
        updates.append(f"city = ${len(params)}")
    if data.street is not None:
        params.append(data.street.strip())
        updates.append(f"street = ${len(params)}")
    if data.is_active is not None:
        params.append(data.is_active)
        updates.append(f"is_active = ${len(params)}")
    if data.notes is not None:
        clean_notes = data.notes.strip() if data.notes else None
        params.append(clean_notes)
        updates.append(f"notes = ${len(params)}")
    if data.sort_order is not None:
        params.append(data.sort_order)
        updates.append(f"sort_order = ${len(params)}")

    if not updates:
        row = await pool.fetchrow("SELECT * FROM delivery_addresses WHERE id = $1", address_id)
        if not row:
            raise HTTPException(status_code=404, detail="Адресу не знайдено")
        return AdminDeliveryAddressOut(**dict(row))

    updates.append("updated_at = NOW()")
    sql = f"""
        UPDATE delivery_addresses
        SET {", ".join(updates)}
        WHERE id = $1
        RETURNING id, city, street, is_active, notes, sort_order, created_at, updated_at
    """
    try:
        row = await pool.fetchrow(sql, *params)
    except asyncpg.UniqueViolationError as err:
        raise HTTPException(
            status_code=400,
            detail="Адреса з такою назвою для цього міста вже існує",
        ) from err
    if not row:
        raise HTTPException(status_code=404, detail="Адресу не знайдено")
    return AdminDeliveryAddressOut(**dict(row))


@router.delete("/delivery/addresses/{address_id}")
async def admin_delete_delivery_address(
    address_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення адреси з довідника."""
    row = await pool.fetchrow(
        "DELETE FROM delivery_addresses WHERE id = $1 RETURNING id", address_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Адресу не знайдено")
    return {"status": "ok", "deleted_id": address_id}
