import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    CategoryAdminOut,
    CategoryCreateIn,
    CategoryUpdateIn,
)
from src.services.cache import invalidate_catalog_cache

router = APIRouter()


@router.post("/catalog/cache/clear")
async def clear_catalog_cache(
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """
    Примусово очищає весь кеш публічного каталогу (категорії, товари, модифікатори, контакти).
    Доступно співробітникам (адміністраторам та менеджерам).
    """
    cleared = await invalidate_catalog_cache()
    return {"status": "ok", "cleared_keys": cleared}


# ============================================================================
# 3. Категорії (Staff)
# ============================================================================


@router.get("/categories", response_model=list[CategoryAdminOut])
async def list_admin_categories(
    location_id: int | None = Query(None),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Список усіх категорій із кількістю товарів (включно з прихованими)."""
    target_loc = staff["location_id"] if staff["role"] == "manager" else location_id

    query = """
        SELECT c.id, c.name, c.icon, c.parent_id, c.location_id,
               c.sort_order, c.is_visible, l.name AS location_name,
               COUNT(p.id)::int AS products_count
        FROM categories c
        JOIN locations l ON l.id = c.location_id
        LEFT JOIN categories p_cat ON p_cat.id = c.parent_id
        LEFT JOIN products p ON p.category_id = c.id
        WHERE ($1::int IS NULL OR c.location_id = $1)
        GROUP BY c.id, l.name, p_cat.sort_order
        ORDER BY c.location_id,
                 COALESCE(p_cat.sort_order, c.sort_order),
                 c.parent_id NULLS FIRST,
                 c.sort_order, c.id
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, target_loc)
    return [CategoryAdminOut(**dict(r)) for r in rows]


@router.post("/categories", response_model=CategoryAdminOut)
async def create_category(
    data: CategoryCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Створення нової категорії страв."""
    if (
        staff["role"] == "manager"
        and staff["location_id"]
        and data.location_id != staff["location_id"]
    ):
        raise HTTPException(
            status_code=403, detail="Ви можете додавати категорії лише для свого закладу"
        )

    async with pool.acquire() as conn:
        loc_name = await conn.fetchval("SELECT name FROM locations WHERE id = $1", data.location_id)
        async with conn.transaction():
            if data.sort_order is not None:
                await conn.execute(
                    """
                    UPDATE categories
                    SET sort_order = sort_order + 1
                    WHERE location_id = $1
                      AND (parent_id IS NOT DISTINCT FROM $2)
                      AND sort_order >= $3
                    """,
                    data.location_id,
                    data.parent_id,
                    data.sort_order,
                )

            row = await conn.fetchrow(
                """
                INSERT INTO categories (name, location_id, parent_id, icon, sort_order, is_visible)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, name, location_id, parent_id, icon, sort_order, is_visible
                """,
                data.name,
                data.location_id,
                data.parent_id,
                data.icon,
                data.sort_order,
                data.is_visible,
            )

    res = dict(row)
    res["location_name"] = loc_name
    res["products_count"] = 0
    await invalidate_catalog_cache()
    return CategoryAdminOut(**res)


@router.patch("/categories/{category_id}", response_model=CategoryAdminOut)
async def update_category(
    category_id: int,
    data: CategoryUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Редагування категорії."""
    async with pool.acquire() as conn:
        cat = await conn.fetchrow(
            "SELECT location_id, parent_id, sort_order FROM categories WHERE id = $1",
            category_id,
        )
        if not cat:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and cat["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до категорій іншого закладу")

        update_dict = data.model_dump(exclude_unset=True)

        async with conn.transaction():
            if "sort_order" in update_dict and update_dict["sort_order"] is not None:
                new_sort_order = update_dict["sort_order"]
                new_parent_id = update_dict.get("parent_id", cat["parent_id"])
                target_loc = update_dict.get("location_id", cat["location_id"])

                await conn.execute(
                    """
                    UPDATE categories
                    SET sort_order = sort_order + 1
                    WHERE location_id = $1
                      AND (parent_id IS NOT DISTINCT FROM $2)
                      AND sort_order >= $3
                      AND id <> $4
                    """,
                    target_loc,
                    new_parent_id,
                    new_sort_order,
                    category_id,
                )

            updates = []
            params = [category_id]
            for field, val in update_dict.items():
                params.append(val)
                updates.append(f"{field} = ${len(params)}")

            if updates:
                await conn.execute(
                    f"UPDATE categories SET {', '.join(updates)} WHERE id = $1",
                    *params,
                )

            updated = await conn.fetchrow(
                """
                SELECT c.id, c.name, c.icon, c.parent_id, c.location_id,
                       c.sort_order, c.is_visible, l.name AS location_name,
                       COUNT(p.id)::int AS products_count
                FROM categories c
                JOIN locations l ON l.id = c.location_id
                LEFT JOIN products p ON p.category_id = c.id
                WHERE c.id = $1
                GROUP BY c.id, l.name
                """,
                category_id,
            )

    await invalidate_catalog_cache()
    return CategoryAdminOut(**dict(updated))


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення категорії (та її підкатегорій/страв каскадно)."""
    async with pool.acquire() as conn:
        cat = await conn.fetchrow("SELECT location_id FROM categories WHERE id = $1", category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and cat["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до категорій іншого закладу")

        await conn.execute("DELETE FROM categories WHERE id = $1", category_id)

    await invalidate_catalog_cache()
    return {"status": "ok", "message": "Категорію видалено"}
