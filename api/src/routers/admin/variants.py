import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    AvailabilityUpdateIn,
    VariantAdminOut,
    VariantCreateIn,
    VariantSelectorOut,
    VariantUpdateIn,
)

router = APIRouter()


@router.post("/products/{product_id}/variants", response_model=VariantAdminOut)
async def create_variant(
    product_id: int,
    data: VariantCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Додавання розміру / порції для страви."""
    async with pool.acquire() as conn:
        p = await conn.fetchrow(
            """
            SELECT p.id, c.location_id
            FROM products p
            JOIN categories c ON c.id = p.category_id
            WHERE p.id = $1
            """,
            product_id,
        )
        if not p:
            raise HTTPException(status_code=404, detail="Страву не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and p["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу")

        row = await conn.fetchrow(
            """
            INSERT INTO product_variants (
                product_id, label, price, weight, sort_order, is_available
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, product_id, label, price, weight, sort_order, is_available
            """,
            product_id,
            data.label,
            data.price,
            data.weight,
            data.sort_order,
            data.is_available,
        )

    return VariantAdminOut(**dict(row))


@router.patch("/variants/{variant_id}", response_model=VariantAdminOut)
async def update_variant(
    variant_id: int,
    data: VariantUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Редагування варіанту ціни."""
    async with pool.acquire() as conn:
        v = await conn.fetchrow(
            """
            SELECT v.id, c.location_id
            FROM product_variants v
            JOIN products p ON p.id = v.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE v.id = $1
            """,
            variant_id,
        )
        if not v:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and v["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу")

        updates = []
        params = [variant_id]
        for field, val in data.model_dump(exclude_unset=True).items():
            params.append(val)
            updates.append(f"{field} = ${len(params)}")

        if updates:
            await conn.execute(
                f"UPDATE product_variants SET {', '.join(updates)} WHERE id = $1",
                *params,
            )

        updated = await conn.fetchrow(
            "SELECT * FROM product_variants WHERE id = $1",
            variant_id,
        )

    return VariantAdminOut(**dict(updated))


@router.delete("/variants/{variant_id}")
async def delete_variant(
    variant_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення варіанту ціни."""
    async with pool.acquire() as conn:
        v = await conn.fetchrow(
            """
            SELECT v.id, v.product_id, c.location_id
            FROM product_variants v
            JOIN products p ON p.id = v.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE v.id = $1
            """,
            variant_id,
        )
        if not v:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and v["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу")

        variants_count = await conn.fetchval(
            "SELECT COUNT(*) FROM product_variants WHERE product_id = $1",
            v["product_id"],
        )
        if variants_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="У страви повинен залишатися хоча б один варіант ціни",
            )

        await conn.execute("DELETE FROM product_variants WHERE id = $1", variant_id)

    return {"status": "ok", "message": "Варіант видалено"}


@router.patch("/variants/{variant_id}/toggle-availability")
async def toggle_variant_availability(
    variant_id: int,
    data: AvailabilityUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Швидке включення / виключення окремого розміру/варіанту зі стоп-листа."""
    async with pool.acquire() as conn:
        v = await conn.fetchrow(
            """
            SELECT v.id, c.location_id
            FROM product_variants v
            JOIN products p ON p.id = v.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE v.id = $1
            """,
            variant_id,
        )
        if not v:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and v["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу")

        await conn.execute(
            "UPDATE product_variants SET is_available = $1 WHERE id = $2",
            data.is_available,
            variant_id,
        )

    return {"id": variant_id, "is_available": data.is_available}


@router.get("/variant-choices", response_model=list[VariantSelectorOut])
async def list_variant_choices(
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Список усіх страв та їхніх варіантів для вибору при додаванні в групу додатків."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT pv.id AS variant_id, pv.product_id, p.name AS product_name,
                   pv.label AS variant_label, pv.price, c.name AS category_name
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            JOIN categories c ON c.id = p.category_id
            ORDER BY c.sort_order, p.name, pv.sort_order
            """
        )
    return [VariantSelectorOut(**dict(r)) for r in rows]
