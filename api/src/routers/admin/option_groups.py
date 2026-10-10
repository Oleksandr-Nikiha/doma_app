import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    OptionGroupAdminOut,
    OptionGroupCreateIn,
    OptionGroupItemAdminOut,
    OptionGroupItemCreateIn,
    OptionGroupItemUpdateIn,
    OptionGroupUpdateIn,
    ProductOptionGroupAdminOut,
    ProductOptionGroupAttachIn,
    ProductOptionGroupUpdateIn,
)

router = APIRouter()

@router.get("/option-groups", response_model=list[OptionGroupAdminOut])
async def list_option_groups(
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Список усіх груп додатків (модифікаторів) з кількістю товарів і позицій."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT g.id, g.name, g.sort_order,
                   COUNT(DISTINCT ogi.variant_id)::int AS items_count,
                   COUNT(DISTINCT pog.product_id)::int AS products_count
            FROM option_groups g
            LEFT JOIN option_group_items ogi ON ogi.group_id = g.id
            LEFT JOIN product_option_groups pog ON pog.group_id = g.id
            GROUP BY g.id
            ORDER BY g.sort_order, g.id
            """
        )
    return [OptionGroupAdminOut(**dict(r)) for r in rows]


@router.post("/option-groups", response_model=OptionGroupAdminOut)
async def create_option_group(
    data: OptionGroupCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Створення нової групи додатків."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO option_groups (name, sort_order)
            VALUES ($1, $2)
            RETURNING id, name, sort_order
            """,
            data.name,
            data.sort_order,
        )
    res = dict(row)
    res["items_count"] = 0
    res["products_count"] = 0
    return OptionGroupAdminOut(**res)


@router.patch("/option-groups/{group_id}", response_model=OptionGroupAdminOut)
async def update_option_group(
    group_id: int,
    data: OptionGroupUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Редагування назви або сортування групи додатків."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM option_groups WHERE id = $1", group_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Групу додатків не знайдено")

        updates = []
        params = [group_id]
        if data.name is not None:
            params.append(data.name)
            updates.append(f"name = ${len(params)}")
        if data.sort_order is not None:
            params.append(data.sort_order)
            updates.append(f"sort_order = ${len(params)}")

        if updates:
            await conn.execute(
                f"UPDATE option_groups SET {', '.join(updates)} WHERE id = $1",
                *params,
            )

        row = await conn.fetchrow(
            """
            SELECT g.id, g.name, g.sort_order,
                   COUNT(DISTINCT ogi.variant_id)::int AS items_count,
                   COUNT(DISTINCT pog.product_id)::int AS products_count
            FROM option_groups g
            LEFT JOIN option_group_items ogi ON ogi.group_id = g.id
            LEFT JOIN product_option_groups pog ON pog.group_id = g.id
            WHERE g.id = $1
            GROUP BY g.id
            """,
            group_id,
        )
    return OptionGroupAdminOut(**dict(row))


@router.delete("/option-groups/{group_id}")
async def delete_option_group(
    group_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення групи додатків (каскадно видаляє її зі страв та переліку позицій)."""
    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchrow("SELECT id FROM option_groups WHERE id = $1", group_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Групу додатків не знайдено")

        await conn.execute("DELETE FROM product_option_groups WHERE group_id = $1", group_id)
        await conn.execute("DELETE FROM option_group_items WHERE group_id = $1", group_id)
        await conn.execute("DELETE FROM option_groups WHERE id = $1", group_id)

    return {"status": "ok", "message": "Групу додатків видалено"}


# ============================================================================
# 8. Позиції всередині групи додатків (Option Group Items)
# ============================================================================


@router.get("/option-groups/{group_id}/items", response_model=list[OptionGroupItemAdminOut])
async def list_option_group_items(
    group_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Отримання списку позицій у групі додатків з доплатами."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ogi.group_id, ogi.variant_id, ogi.price_delta, ogi.sort_order, ogi.is_available,
                   pv.product_id, pv.label AS variant_label, p.name AS product_name
            FROM option_group_items ogi
            JOIN product_variants pv ON pv.id = ogi.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE ogi.group_id = $1
            ORDER BY ogi.sort_order, ogi.variant_id
            """,
            group_id,
        )
    return [OptionGroupItemAdminOut(**dict(r)) for r in rows]


@router.post("/option-groups/{group_id}/items", response_model=OptionGroupItemAdminOut)
async def add_option_group_item(
    group_id: int,
    data: OptionGroupItemCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Додавання позиції (варіанту товару) до групи додатків з доплатою."""
    async with pool.acquire() as conn:
        v = await conn.fetchrow(
            """
            SELECT pv.id, pv.product_id, pv.label AS variant_label, p.name AS product_name
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = $1
            """,
            data.variant_id,
        )
        if not v:
            raise HTTPException(status_code=404, detail="Вказаний варіант товару не знайдено")

        row = await conn.fetchrow(
            """
            INSERT INTO option_group_items (
                group_id, variant_id, price_delta, sort_order, is_available
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (group_id, variant_id) DO UPDATE
                SET price_delta = EXCLUDED.price_delta,
                    sort_order = EXCLUDED.sort_order,
                    is_available = EXCLUDED.is_available
            RETURNING group_id, variant_id, price_delta, sort_order, is_available
            """,
            group_id,
            data.variant_id,
            data.price_delta,
            data.sort_order,
            data.is_available,
        )

    res = dict(row)
    res["product_id"] = v["product_id"]
    res["product_name"] = v["product_name"]
    res["variant_label"] = v["variant_label"]
    return OptionGroupItemAdminOut(**res)


@router.patch(
    "/option-groups/{group_id}/items/{variant_id}", response_model=OptionGroupItemAdminOut
)
async def update_option_group_item(
    group_id: int,
    variant_id: int,
    data: OptionGroupItemUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення ціни або доступності позиції в групі додатків."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT 1 FROM option_group_items WHERE group_id = $1 AND variant_id = $2",
            group_id,
            variant_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Позицію в групі не знайдено")

        updates = []
        params = [group_id, variant_id]
        if data.price_delta is not None:
            params.append(data.price_delta)
            updates.append(f"price_delta = ${len(params)}")
        if data.sort_order is not None:
            params.append(data.sort_order)
            updates.append(f"sort_order = ${len(params)}")
        if data.is_available is not None:
            params.append(data.is_available)
            updates.append(f"is_available = ${len(params)}")

        if updates:
            set_clause = ", ".join(updates)
            await conn.execute(
                f"UPDATE option_group_items SET {set_clause} "
                "WHERE group_id = $1 AND variant_id = $2",
                *params,
            )

        row = await conn.fetchrow(
            """
            SELECT ogi.group_id, ogi.variant_id, ogi.price_delta, ogi.sort_order, ogi.is_available,
                   pv.product_id, pv.label AS variant_label, p.name AS product_name
            FROM option_group_items ogi
            JOIN product_variants pv ON pv.id = ogi.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE ogi.group_id = $1 AND ogi.variant_id = $2
            """,
            group_id,
            variant_id,
        )
    return OptionGroupItemAdminOut(**dict(row))


@router.delete("/option-groups/{group_id}/items/{variant_id}")
async def delete_option_group_item(
    group_id: int,
    variant_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    _: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення позиції з групи додатків."""
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM option_group_items WHERE group_id = $1 AND variant_id = $2",
            group_id,
            variant_id,
        )
    return {"status": "ok", "message": "Позицію вилучено з групи"}


# ============================================================================
# 9. Прив'язка груп додатків до страв (Product Option Groups)
# ============================================================================


@router.post("/products/{product_id}/option-groups", response_model=ProductOptionGroupAdminOut)
async def attach_option_group_to_product(
    product_id: int,
    data: ProductOptionGroupAttachIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Прикріплення групи додатків до страви з правилами вибору (мін/макс/безкоштовно)."""
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
            raise HTTPException(status_code=403, detail="Немає доступу до страви іншого закладу")

        group = await conn.fetchrow("SELECT name FROM option_groups WHERE id = $1", data.group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Групу додатків не знайдено")

        if data.min_select < 0 or data.max_select < data.min_select:
            raise HTTPException(
                status_code=400,
                detail="Некоректні ліміти: max_select повинен бути >= min_select >= 0",
            )

        row = await conn.fetchrow(
            """
            INSERT INTO product_option_groups (
                product_id, group_id, min_select, max_select, free_count, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (product_id, group_id) DO UPDATE
                SET min_select = EXCLUDED.min_select,
                    max_select = EXCLUDED.max_select,
                    free_count = EXCLUDED.free_count,
                    sort_order = EXCLUDED.sort_order
            RETURNING product_id, group_id, min_select, max_select, free_count, sort_order
            """,
            product_id,
            data.group_id,
            data.min_select,
            data.max_select,
            data.free_count,
            data.sort_order,
        )

    res = dict(row)
    res["group_name"] = group["name"]
    return ProductOptionGroupAdminOut(**res)


@router.patch(
    "/products/{product_id}/option-groups/{group_id}", response_model=ProductOptionGroupAdminOut
)
async def update_product_option_group(
    product_id: int,
    group_id: int,
    data: ProductOptionGroupUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Зміна налаштувань вибору групи додатків для страви."""
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

        existing = await conn.fetchrow(
            """
            SELECT pog.min_select, pog.max_select, pog.free_count,
                   pog.sort_order, g.name AS group_name
            FROM product_option_groups pog
            JOIN option_groups g ON g.id = pog.group_id
            WHERE pog.product_id = $1 AND pog.group_id = $2
            """,
            product_id,
            group_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Прив'язку групи додатків не знайдено")

        new_min = data.min_select if data.min_select is not None else existing["min_select"]
        new_max = data.max_select if data.max_select is not None else existing["max_select"]
        new_free = data.free_count if data.free_count is not None else existing["free_count"]
        new_sort = data.sort_order if data.sort_order is not None else existing["sort_order"]

        if new_min < 0 or new_max < new_min:
            raise HTTPException(
                status_code=400, detail="max_select повинен бути >= min_select >= 0"
            )

        await conn.execute(
            """
            UPDATE product_option_groups
            SET min_select = $1, max_select = $2, free_count = $3, sort_order = $4
            WHERE product_id = $5 AND group_id = $6
            """,
            new_min,
            new_max,
            new_free,
            new_sort,
            product_id,
            group_id,
        )

    return ProductOptionGroupAdminOut(
        product_id=product_id,
        group_id=group_id,
        group_name=existing["group_name"],
        min_select=new_min,
        max_select=new_max,
        free_count=new_free,
        sort_order=new_sort,
    )


@router.delete("/products/{product_id}/option-groups/{group_id}")
async def detach_option_group_from_product(
    product_id: int,
    group_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Відв'язка групи додатків від страви."""
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

        await conn.execute(
            "DELETE FROM product_option_groups WHERE product_id = $1 AND group_id = $2",
            product_id,
            group_id,
        )
    return {"status": "ok", "message": "Групу додатків відв'язано від страви"}
