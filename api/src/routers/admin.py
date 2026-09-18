import html
import json
import logging
import urllib.request

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from src.auth.deps import get_current_staff, get_current_user
from src.config import get_settings
from src.db.connection import get_pool
from src.schemas.admin import (
    AdminMeOut,
    AdminOrderDetailOut,
    AdminOrderGroupOut,
    AdminOrderItemOptionOut,
    AdminOrderItemOut,
    AdminOrderListItemOut,
    AdminOrderUpdateIn,
    AdminUserOut,
    AdminUserUpdateIn,
    AvailabilityUpdateIn,
    BulkAvailabilityIn,
    BulkOptionGroupActionIn,
    CategoryAdminOut,
    CategoryCreateIn,
    CategoryUpdateIn,
    LocationDeliveryAdminOut,
    LocationDeliveryUpdateIn,
    ManagerCreateIn,
    ManagerOut,
    ManagerUpdateIn,
    OptionGroupAdminOut,
    OptionGroupCreateIn,
    OptionGroupItemAdminOut,
    OptionGroupItemCreateIn,
    OptionGroupItemUpdateIn,
    OptionGroupUpdateIn,
    ProductAdminOut,
    ProductCreateIn,
    ProductOptionGroupAdminOut,
    ProductOptionGroupAttachIn,
    ProductOptionGroupUpdateIn,
    ProductUpdateIn,
    VariantAdminOut,
    VariantCreateIn,
    VariantSelectorOut,
    VariantUpdateIn,
)
from src.schemas.delivery_address import (
    AdminDeliveryAddressOut,
    DeliveryAddressCreateIn,
    DeliveryAddressUpdateIn,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ============================================================================
# 1. Права поточного користувача
# ============================================================================


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


# ============================================================================
# 2. Управління менеджерами (Тільки Admin)
# ============================================================================


@router.get("/managers", response_model=list[ManagerOut])
async def list_managers(
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Список усіх менеджерів та адміністраторів."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.telegram_id, u.full_name, u.phone, m.role,
                   m.location_id, l.name AS location_name, m.is_active
            FROM managers m
            JOIN users u ON u.telegram_id = m.telegram_id
            LEFT JOIN locations l ON l.id = m.location_id
            ORDER BY m.role ASC, m.id ASC
            """
        )
    return [ManagerOut(**dict(r)) for r in rows]


@router.post("/managers", response_model=ManagerOut)
async def create_manager(
    data: ManagerCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Призначення користувача менеджером або адміном."""
    if staff["role"] != "admin" and data.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Тільки головний адміністратор може призначати роль 'admin'.",
        )

    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT full_name, phone FROM users WHERE telegram_id = $1",
            data.telegram_id,
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Користувача з telegram_id {data.telegram_id} не знайдено в базі.",
            )

        if data.location_id is not None:
            loc = await conn.fetchval("SELECT id FROM locations WHERE id = $1", data.location_id)
            if not loc:
                raise HTTPException(status_code=400, detail="Вказаний заклад не існує")

        row = await conn.fetchrow(
            """
            INSERT INTO managers (telegram_id, role, location_id, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (telegram_id) DO UPDATE
                SET role = EXCLUDED.role,
                    location_id = EXCLUDED.location_id,
                    is_active = true,
                    updated_at = now()
            RETURNING id, telegram_id, role, location_id, is_active
            """,
            data.telegram_id,
            data.role,
            data.location_id,
        )

        location_name = None
        if row["location_id"]:
            location_name = await conn.fetchval(
                "SELECT name FROM locations WHERE id = $1", row["location_id"]
            )

    return ManagerOut(
        id=row["id"],
        telegram_id=row["telegram_id"],
        full_name=user["full_name"],
        phone=user["phone"],
        role=row["role"],
        location_id=row["location_id"],
        location_name=location_name,
        is_active=row["is_active"],
    )


@router.patch("/managers/{manager_id}", response_model=ManagerOut)
async def update_manager(
    manager_id: int,
    data: ManagerUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення ролі, закладу або статусу активності менеджера."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, telegram_id, role FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")

        if existing["role"] == "admin" and staff["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Менеджер не може змінювати головного адміністратора.",
            )

        if data.role == "admin" and staff["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Тільки головний адміністратор може призначати роль 'admin'.",
            )

        if existing["telegram_id"] == staff["telegram_id"] and data.is_active is False:
            raise HTTPException(status_code=400, detail="Не можна деактивувати власний акаунт")

        updates = []
        params = [manager_id]

        if data.role is not None:
            params.append(data.role)
            updates.append(f"role = ${len(params)}")
        if data.location_id is not None:
            params.append(data.location_id)
            updates.append(f"location_id = ${len(params)}")
        if data.is_active is not None:
            params.append(data.is_active)
            updates.append(f"is_active = ${len(params)}")

        if updates:
            updates.append("updated_at = now()")
            await conn.execute(
                f"UPDATE managers SET {', '.join(updates)} WHERE id = $1",
                *params,
            )

        row = await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, u.full_name, u.phone, m.role,
                   m.location_id, l.name AS location_name, m.is_active
            FROM managers m
            JOIN users u ON u.telegram_id = m.telegram_id
            LEFT JOIN locations l ON l.id = m.location_id
            WHERE m.id = $1
            """,
            manager_id,
        )

    return ManagerOut(**dict(row))


@router.delete("/managers/{manager_id}")
async def delete_manager(
    manager_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення менеджера зі штату."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT telegram_id, role FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")

        if existing["role"] == "admin" and staff["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Менеджер не може видаляти головного адміністратора.",
            )

        if existing["telegram_id"] == staff["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")

        await conn.execute("DELETE FROM managers WHERE id = $1", manager_id)
    return {"status": "ok", "message": "Менеджера успішно видалено"}


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
        LEFT JOIN products p ON p.category_id = c.id
        WHERE ($1::int IS NULL OR c.location_id = $1)
        GROUP BY c.id, l.name
        ORDER BY c.location_id,
                 COALESCE(c.parent_id, c.id),
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
        loc_name = await conn.fetchval("SELECT name FROM locations WHERE id = $1", data.location_id)

    res = dict(row)
    res["location_name"] = loc_name
    res["products_count"] = 0
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
        cat = await conn.fetchrow("SELECT location_id FROM categories WHERE id = $1", category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and cat["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до категорій іншого закладу")

        updates = []
        params = [category_id]
        for field, val in data.model_dump(exclude_unset=True).items():
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

    return {"status": "ok", "message": "Категорію видалено"}


# ============================================================================
# 4. Страви та Варіанти (Products & Variants)
# ============================================================================


@router.get("/products", response_model=list[ProductAdminOut])
async def list_admin_products(
    category_id: int | None = Query(None),
    location_id: int | None = Query(None),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Отримання списку страв з усіма варіантами (розмірами/цінами)."""
    target_loc = staff["location_id"] if staff["role"] == "manager" else location_id

    async with pool.acquire() as conn:
        products = await conn.fetch(
            """
            SELECT p.id, p.name, p.category_id, c.name AS category_name,
                   c.location_id, l.name AS location_name,
                   p.description, p.image_url, p.sort_order, p.is_available
            FROM products p
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN locations l ON l.id = c.location_id
            WHERE ($1::int IS NULL OR p.category_id = $1)
              AND ($2::int IS NULL OR c.location_id = $2)
            ORDER BY c.sort_order, p.sort_order, p.id
            """,
            category_id,
            target_loc,
        )

        variants = await conn.fetch(
            """
            SELECT id, product_id, label, price, weight, sort_order, is_available
            FROM product_variants
            ORDER BY sort_order, id
            """
        )

        pogs = await conn.fetch(
            """
            SELECT pog.product_id, pog.group_id, g.name AS group_name,
                   pog.min_select, pog.max_select, pog.free_count, pog.sort_order
            FROM product_option_groups pog
            JOIN option_groups g ON g.id = pog.group_id
            ORDER BY pog.sort_order, pog.group_id
            """
        )

    # Групуємо варіанти по product_id
    variants_by_product: dict[int, list[VariantAdminOut]] = {}
    for v in variants:
        v_out = VariantAdminOut(**dict(v))
        variants_by_product.setdefault(v["product_id"], []).append(v_out)

    pogs_by_product: dict[int, list[ProductOptionGroupAdminOut]] = {}
    for pg in pogs:
        pg_out = ProductOptionGroupAdminOut(**dict(pg))
        pogs_by_product.setdefault(pg["product_id"], []).append(pg_out)

    result = []
    for p in products:
        p_dict = dict(p)
        p_dict["variants"] = variants_by_product.get(p["id"], [])
        p_dict["option_groups"] = pogs_by_product.get(p["id"], [])
        result.append(ProductAdminOut(**p_dict))

    return result


@router.post("/products", response_model=ProductAdminOut)
async def create_product(
    data: ProductCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Створення нової страви разом із варіантами цін."""
    async with pool.acquire() as conn, conn.transaction():
        cat = await conn.fetchrow(
            """
            SELECT c.id, c.name, c.location_id, l.name AS location_name
            FROM categories c
            JOIN locations l ON l.id = c.location_id
            WHERE c.id = $1
            """,
            data.category_id,
        )
        if not cat:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and cat["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до цієї категорії")

        p_row = await conn.fetchrow(
            """
            INSERT INTO products (
                category_id, name, description, image_url, sort_order, is_available
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, category_id, name, description, image_url, sort_order, is_available
            """,
            data.category_id,
            data.name,
            data.description,
            data.image_url,
            data.sort_order,
            data.is_available,
        )
        product_id = p_row["id"]

        variants_out = []
        variants_to_insert = data.variants or [
            VariantCreateIn(label="Стандарт", price=0.0, sort_order=0, is_available=True)
        ]

        for v in variants_to_insert:
            v_row = await conn.fetchrow(
                """
                INSERT INTO product_variants (
                    product_id, label, price, weight, sort_order, is_available
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, product_id, label, price, weight, sort_order, is_available
                """,
                product_id,
                v.label,
                v.price,
                v.weight,
                v.sort_order,
                v.is_available,
            )
            variants_out.append(VariantAdminOut(**dict(v_row)))

    res = dict(p_row)
    res["category_name"] = cat["name"]
    res["location_id"] = cat["location_id"]
    res["location_name"] = cat["location_name"]
    res["variants"] = variants_out
    return ProductAdminOut(**res)


@router.patch("/products/bulk/availability")
async def bulk_toggle_products_availability(
    data: BulkAvailabilityIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Масова зміна доступності страв (включення / виключення зі стоп-листа)."""
    if not data.product_ids:
        return {"updated_count": 0, "product_ids": [], "is_available": data.is_available}

    async with pool.acquire() as conn:
        if staff["role"] == "manager" and staff["location_id"]:
            allowed = await conn.fetch(
                """
                SELECT p.id
                FROM products p
                JOIN categories c ON c.id = p.category_id
                WHERE p.id = ANY($1::int[]) AND c.location_id = $2
                """,
                data.product_ids,
                staff["location_id"],
            )
            product_ids = [r["id"] for r in allowed]
        else:
            allowed = await conn.fetch(
                "SELECT id FROM products WHERE id = ANY($1::int[])",
                data.product_ids,
            )
            product_ids = [r["id"] for r in allowed]

        if not product_ids:
            return {"updated_count": 0, "product_ids": [], "is_available": data.is_available}

        await conn.execute(
            "UPDATE products SET is_available = $1 WHERE id = ANY($2::int[])",
            data.is_available,
            product_ids,
        )
        await conn.execute(
            "UPDATE product_variants SET is_available = $1 WHERE product_id = ANY($2::int[])",
            data.is_available,
            product_ids,
        )

    return {
        "updated_count": len(product_ids),
        "product_ids": product_ids,
        "is_available": data.is_available,
    }


@router.post("/products/bulk/option-groups")
async def bulk_manage_product_option_groups(
    data: BulkOptionGroupActionIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Масове керування додатками до страв: attach, detach, replace, clear."""
    if not data.product_ids:
        return {"updated_count": 0, "product_ids": [], "action": data.action}

    async with pool.acquire() as conn:
        if staff["role"] == "manager" and staff["location_id"]:
            allowed = await conn.fetch(
                """
                SELECT p.id
                FROM products p
                JOIN categories c ON c.id = p.category_id
                WHERE p.id = ANY($1::int[]) AND c.location_id = $2
                """,
                data.product_ids,
                staff["location_id"],
            )
            product_ids = [r["id"] for r in allowed]
        else:
            allowed = await conn.fetch(
                "SELECT id FROM products WHERE id = ANY($1::int[])",
                data.product_ids,
            )
            product_ids = [r["id"] for r in allowed]

        if not product_ids:
            return {"updated_count": 0, "product_ids": [], "action": data.action}

        if data.action == "attach":
            if not data.group_id:
                raise HTTPException(status_code=400, detail="group_id є обов'язковим для attach")
            group = await conn.fetchrow("SELECT id FROM option_groups WHERE id = $1", data.group_id)
            if not group:
                raise HTTPException(status_code=404, detail="Групу додатків не знайдено")
            if data.min_select < 0 or data.max_select < data.min_select:
                raise HTTPException(
                    status_code=400,
                    detail="Некоректні ліміти: max_select повинен бути >= min_select >= 0",
                )
            await conn.execute(
                """
                INSERT INTO product_option_groups (
                    product_id, group_id, min_select, max_select, free_count, sort_order
                )
                SELECT pid, $2, $3, $4, $5, 0
                FROM unnest($1::int[]) AS pid
                ON CONFLICT (product_id, group_id) DO UPDATE
                    SET min_select = EXCLUDED.min_select,
                        max_select = EXCLUDED.max_select,
                        free_count = EXCLUDED.free_count
                """,
                product_ids,
                data.group_id,
                data.min_select,
                data.max_select,
                data.free_count,
            )

        elif data.action == "detach":
            if not data.group_id:
                raise HTTPException(status_code=400, detail="group_id є обов'язковим для detach")
            await conn.execute(
                """
                DELETE FROM product_option_groups
                WHERE product_id = ANY($1::int[]) AND group_id = $2
                """,
                product_ids,
                data.group_id,
            )

        elif data.action == "replace":
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM product_option_groups WHERE product_id = ANY($1::int[])",
                    product_ids,
                )
                if data.groups:
                    for g in data.groups:
                        if g.min_select < 0 or g.max_select < g.min_select:
                            raise HTTPException(
                                status_code=400,
                                detail=(
                                    f"Некоректні ліміти для групи {g.group_id}: "
                                    "max_select >= min_select >= 0"
                                ),
                            )
                        await conn.execute(
                            """
                            INSERT INTO product_option_groups (
                                product_id, group_id, min_select, max_select, free_count, sort_order
                            )
                            SELECT pid, $2, $3, $4, $5, $6
                            FROM unnest($1::int[]) AS pid
                            ON CONFLICT (product_id, group_id) DO UPDATE
                                SET min_select = EXCLUDED.min_select,
                                    max_select = EXCLUDED.max_select,
                                    free_count = EXCLUDED.free_count,
                                    sort_order = EXCLUDED.sort_order
                            """,
                            product_ids,
                            g.group_id,
                            g.min_select,
                            g.max_select,
                            g.free_count,
                            g.sort_order,
                        )

        elif data.action == "clear":
            await conn.execute(
                "DELETE FROM product_option_groups WHERE product_id = ANY($1::int[])",
                product_ids,
            )

    return {
        "updated_count": len(product_ids),
        "product_ids": product_ids,
        "action": data.action,
    }


@router.patch("/products/{product_id}", response_model=ProductAdminOut)
async def update_product(
    product_id: int,
    data: ProductUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення основних даних страви."""
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

        updates = []
        params = [product_id]
        for field, val in data.model_dump(exclude_unset=True).items():
            params.append(val)
            updates.append(f"{field} = ${len(params)}")

        if updates:
            await conn.execute(
                f"UPDATE products SET {', '.join(updates)} WHERE id = $1",
                *params,
            )

        updated_p = await conn.fetchrow(
            """
            SELECT p.id, p.name, p.category_id, c.name AS category_name,
                   c.location_id, l.name AS location_name,
                   p.description, p.image_url, p.sort_order, p.is_available
            FROM products p
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN locations l ON l.id = c.location_id
            WHERE p.id = $1
            """,
            product_id,
        )
        variants = await conn.fetch(
            "SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id",
            product_id,
        )

    res = dict(updated_p)
    res["variants"] = [VariantAdminOut(**dict(v)) for v in variants]
    return ProductAdminOut(**res)


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення страви (та її варіантів каскадно)."""
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

        await conn.execute("DELETE FROM products WHERE id = $1", product_id)

    return {"status": "ok", "message": "Страву видалено"}


# ============================================================================
# 5. Керування варіантами цін (Variants)
# ============================================================================


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


# ============================================================================
# 6. Швидкий стоп-лист (Швидке перемикання наявності)
# ============================================================================


@router.patch("/products/{product_id}/toggle-availability")
async def toggle_product_availability(
    product_id: int,
    data: AvailabilityUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Швидке включення / виключення всієї страви зі стоп-листа."""
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
            "UPDATE products SET is_available = $1 WHERE id = $2",
            data.is_available,
            product_id,
        )

    return {"id": product_id, "is_available": data.is_available}


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


# ============================================================================
# 7. Групи додатків (Option Groups)
# ============================================================================


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


# ============================================================================
# 10. Допоміжний список варіантів для селектора (Variant Selector)
# ============================================================================


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


# ============================================================================
# 11. Налаштування доставки закладів
# ============================================================================


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


# ============================================================================
# 8. Керування користувачами / клієнтами (Users)
# ============================================================================


@router.get("/users", response_model=list[AdminUserOut])
async def list_admin_users(
    query: str = Query("", description="Пошук за номером телефону або ПІБ"),
    limit: int = Query(50, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Пошук клієнтів за номером телефону або ПІБ."""
    clean_q = query.strip()
    sql = """
        SELECT u.id, u.telegram_id, u.full_name, u.phone, u.delivery_address,
               u.is_blocked, u.admin_note,
               to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               COUNT(o.id)::int AS orders_count
        FROM users u
        LEFT JOIN orders o ON o.telegram_id = u.telegram_id
        WHERE ($1 = '' OR u.phone ILIKE '%' || $1 || '%' OR u.full_name ILIKE '%' || $1 || '%' OR u.telegram_id::text ILIKE '%' || $1 || '%')
        GROUP BY u.id
        ORDER BY u.id DESC
        LIMIT $2
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, clean_q, limit)
    return [AdminUserOut(**dict(r)) for r in rows]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_admin_user(
    user_id: int,
    data: AdminUserUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення статусу блокування та примітки про клієнта."""
    updates = []
    params = [user_id]

    if data.is_blocked is not None:
        params.append(data.is_blocked)
        updates.append(f"is_blocked = ${len(params)}")

    if data.admin_note is not None:
        params.append(data.admin_note.strip() if data.admin_note else None)
        updates.append(f"admin_note = ${len(params)}")

    if not updates:
        raise HTTPException(status_code=400, detail="Не вказано полів для оновлення")

    updates.append("updated_at = now()")

    async with pool.acquire() as conn:
        update_sql = f"UPDATE users SET {', '.join(updates)} WHERE id = $1 RETURNING id"
        row_id = await conn.fetchval(update_sql, *params)
        if not row_id:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        row = await conn.fetchrow(
            """
            SELECT u.id, u.telegram_id, u.full_name, u.phone, u.delivery_address,
                   u.is_blocked, u.admin_note,
                   to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   COUNT(o.id)::int AS orders_count
            FROM users u
            LEFT JOIN orders o ON o.telegram_id = u.telegram_id
            WHERE u.id = $1
            GROUP BY u.id
            """,
            user_id,
        )

    return AdminUserOut(**dict(row))


@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення користувача."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id, telegram_id FROM users WHERE id = $1", user_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        if existing["telegram_id"] == staff["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")

        await conn.execute("DELETE FROM managers WHERE telegram_id = $1", existing["telegram_id"])
        await conn.execute("DELETE FROM carts WHERE telegram_id = $1", existing["telegram_id"])
        await conn.execute("DELETE FROM orders WHERE telegram_id = $1", existing["telegram_id"])
        await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    return {"status": "ok", "message": "Користувача успішно видалено"}


# ============================================================================
# 9. Керування та редагування замовлень (Orders)
# ============================================================================


def _send_tg_order_notification(token: str, payload: dict) -> None:
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as e:
        logger.error("Не вдалося відправити повідомлення в Telegram: %s", e)


@router.get("/orders", response_model=list[AdminOrderListItemOut])
async def list_admin_orders(
    status: str | None = Query(None),
    location_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Список замовлень для менеджера/адміністратора."""
    target_loc = staff["location_id"] if staff["role"] == "manager" else location_id

    sql = """
        SELECT o.id, o.telegram_id, o.status, o.fulfillment_type, o.delivery_address,
               o.contact_name, o.contact_phone, o.payment_method, o.scheduled_time,
               o.comment, o.total_price::float AS total_price,
               to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               u.is_blocked AS user_is_blocked, u.admin_note AS user_admin_note,
               og.location_id, loc.name AS location_name,
               COALESCE(
                   (SELECT string_agg(oi.product_name || ' ×' || oi.qty, ', ')
                    FROM order_items oi
                    JOIN order_groups g ON g.id = oi.order_group_id
                    WHERE g.order_id = o.id), ''
               ) AS items_summary
        FROM orders o
        JOIN users u ON u.telegram_id = o.telegram_id
        LEFT JOIN order_groups og ON og.order_id = o.id
        LEFT JOIN locations loc ON loc.id = og.location_id
        WHERE ($1::text IS NULL OR o.status = $1)
          AND ($2::int IS NULL OR og.location_id = $2)
        GROUP BY o.id, u.is_blocked, u.admin_note, og.location_id, loc.name
        ORDER BY o.id DESC
        LIMIT $3
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, status, target_loc, limit)
    return [AdminOrderListItemOut(**dict(r)) for r in rows]


@router.get("/orders/{order_id}", response_model=AdminOrderDetailOut)
async def get_admin_order(
    order_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Детальна інформація про замовлення."""
    async with pool.acquire() as conn:
        order_row = await conn.fetchrow(
            """
            SELECT o.id, o.telegram_id, o.status, o.fulfillment_type, o.delivery_address,
                   o.contact_name, o.contact_phone, o.payment_method, o.scheduled_time,
                   o.comment, o.total_price::float AS total_price,
                   to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   u.is_blocked AS user_is_blocked, u.admin_note AS user_admin_note
            FROM orders o
            JOIN users u ON u.telegram_id = o.telegram_id
            WHERE o.id = $1
            """,
            order_id,
        )
        if not order_row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        group_rows = await conn.fetch(
            """
            SELECT og.id, og.order_id, og.location_id, l.name AS location_name,
                   og.status, og.subtotal::float AS subtotal
            FROM order_groups og
            JOIN locations l ON l.id = og.location_id
            WHERE og.order_id = $1
            ORDER BY og.id
            """,
            order_id,
        )

        if staff["role"] == "manager" and staff["location_id"] is not None:
            loc_ids = [g["location_id"] for g in group_rows]
            if staff["location_id"] not in loc_ids:
                raise HTTPException(status_code=403, detail="Це замовлення належить іншому закладу")

        item_rows = await conn.fetch(
            """
            SELECT oi.id, oi.order_group_id, oi.variant_id, oi.product_name,
                   oi.variant_label, oi.unit_price::float AS unit_price,
                   oi.qty, oi.subtotal::float AS subtotal
            FROM order_items oi
            JOIN order_groups og ON og.id = oi.order_group_id
            WHERE og.order_id = $1
            ORDER BY oi.id
            """,
            order_id,
        )

        item_ids = [r["id"] for r in item_rows]
        option_rows = []
        if item_ids:
            option_rows = await conn.fetch(
                """
                SELECT id, order_item_id, option_group_name, option_name,
                       price_delta::float AS price_delta, qty
                FROM order_item_options
                WHERE order_item_id = ANY($1::int[])
                ORDER BY id
                """,
                item_ids,
            )

    options_by_item: dict[int, list[AdminOrderItemOptionOut]] = {}
    for opt in option_rows:
        item_id = opt["order_item_id"]
        if item_id not in options_by_item:
            options_by_item[item_id] = []
        options_by_item[item_id].append(AdminOrderItemOptionOut(**dict(opt)))

    items_by_group: dict[int, list[AdminOrderItemOut]] = {}
    for it in item_rows:
        gid = it["order_group_id"]
        if gid not in items_by_group:
            items_by_group[gid] = []
        it_dict = dict(it)
        it_dict["options"] = options_by_item.get(it["id"], [])
        items_by_group[gid].append(AdminOrderItemOut(**it_dict))

    groups_out = []
    for g in group_rows:
        g_dict = dict(g)
        g_dict["items"] = items_by_group.get(g["id"], [])
        groups_out.append(AdminOrderGroupOut(**g_dict))

    res_dict = dict(order_row)
    res_dict["groups"] = groups_out
    return AdminOrderDetailOut(**res_dict)


@router.put("/orders/{order_id}", response_model=AdminOrderDetailOut)
async def update_admin_order(
    order_id: int,
    data: AdminOrderUpdateIn,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Редагування замовлення: час доставки, позиції, додатки, контакти, статус."""
    status_changed = False
    new_status = None
    existing_tg_id = None
    existing_fulfillment = None
    existing_scheduled = None
    existing_addr = None
    existing_total = 0.0

    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchrow(
            """
            SELECT id, status, telegram_id, fulfillment_type, scheduled_time,
                   delivery_address, total_price
            FROM orders
            WHERE id = $1
            FOR UPDATE
            """,
            order_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        existing_tg_id = existing["telegram_id"]
        existing_fulfillment = existing["fulfillment_type"]
        existing_scheduled = existing["scheduled_time"]
        existing_addr = existing["delivery_address"]
        existing_total = float(existing["total_price"])

        group_rows = await conn.fetch(
            "SELECT id, location_id FROM order_groups WHERE order_id = $1", order_id
        )
        if not group_rows:
            raise HTTPException(status_code=400, detail="У замовлення немає групи закладів")

        if (
            staff["role"] == "manager"
            and staff["location_id"] is not None
            and staff["location_id"] not in [g["location_id"] for g in group_rows]
        ):
            raise HTTPException(status_code=403, detail="Це замовлення належить іншому закладу")

        # 1. Оновлення полів замовлення
        order_updates = []
        order_params = [order_id]

        if data.scheduled_time is not None:
            clean_time = data.scheduled_time.strip() or None
            order_params.append(clean_time)
            order_updates.append(f"scheduled_time = ${len(order_params)}")
            existing_scheduled = clean_time

        if data.status is not None:
            clean_status = data.status.strip()
            GROUP_STATUS_MAP = {
                "pending_moderation": "pending",
                "confirmed": "accepted",
                "in_progress": "cooking",
                "ready": "ready",
                "completed": "ready",
                "rejected": "cancelled",
                "cancelled": "cancelled",
            }
            if clean_status not in GROUP_STATUS_MAP:
                raise HTTPException(
                    status_code=400,
                    detail=f"Неприпустимий статус замовлення: {clean_status}",
                )
            order_params.append(clean_status)
            order_updates.append(f"status = ${len(order_params)}")
            group_status = GROUP_STATUS_MAP[clean_status]
            await conn.execute(
                "UPDATE order_groups SET status = $1 WHERE order_id = $2", group_status, order_id
            )
            if clean_status != existing["status"]:
                status_changed = True
                new_status = clean_status

        if data.delivery_address is not None:
            clean_addr = data.delivery_address.strip()
            order_params.append(clean_addr)
            order_updates.append(f"delivery_address = ${len(order_params)}")
            existing_addr = clean_addr

        if data.contact_name is not None:
            order_params.append(data.contact_name.strip())
            order_updates.append(f"contact_name = ${len(order_params)}")

        if data.contact_phone is not None:
            order_params.append(data.contact_phone.strip())
            order_updates.append(f"contact_phone = ${len(order_params)}")

        if data.comment is not None:
            order_params.append(data.comment.strip())
            order_updates.append(f"comment = ${len(order_params)}")

        if order_updates:
            order_updates.append("updated_at = now()")
            await conn.execute(
                f"UPDATE orders SET {', '.join(order_updates)} WHERE id = $1", *order_params
            )

        # 2. Якщо передано новий склад страв (items) — перераховуємо та замінюємо
        if data.items is not None:
            if len(data.items) == 0:
                raise HTTPException(status_code=400, detail="Замовлення не може бути порожнім")

            primary_group_id = group_rows[0]["id"]

            await conn.execute(
                "DELETE FROM order_items WHERE order_group_id = ANY($1::int[])",
                [g["id"] for g in group_rows],
            )

            total_calculated_price = 0.0
            for item in data.items:
                options_price = sum(opt.price_delta * opt.qty for opt in item.options)
                item_subtotal = round((item.unit_price + options_price) * item.qty, 2)
                total_calculated_price += item_subtotal

                item_db = await conn.fetchrow(
                    """
                    INSERT INTO order_items (
                        order_group_id, variant_id, product_name, variant_label,
                        unit_price, qty, subtotal
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                    """,
                    primary_group_id,
                    item.variant_id,
                    item.product_name,
                    item.variant_label,
                    item.unit_price,
                    item.qty,
                    item_subtotal,
                )
                saved_item_id = item_db["id"]

                for opt in item.options:
                    await conn.execute(
                        """
                        INSERT INTO order_item_options (
                            order_item_id, option_group_name, option_name, price_delta, qty
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        saved_item_id,
                        opt.option_group_name,
                        opt.option_name,
                        opt.price_delta,
                        opt.qty,
                    )

            await conn.execute(
                "UPDATE order_groups SET subtotal = $1 WHERE id = $2",
                total_calculated_price,
                primary_group_id,
            )
            await conn.execute(
                "UPDATE orders SET total_price = $1, updated_at = now() WHERE id = $2",
                total_calculated_price,
                order_id,
            )

    if status_changed and new_status and existing_tg_id:
        settings = get_settings()
        if settings.bot_token:
            final_total = total_calculated_price if data.items is not None else existing_total
            time_part = f" на {existing_scheduled}" if existing_scheduled else ""
            esc_addr = html.escape(existing_addr or "")
            if new_status == "confirmed":
                client_fulfillment = (
                    f"🛵 Очікуйте кур'єра{time_part} за адресою: <code>{esc_addr}</code>"
                    if existing_fulfillment == "delivery"
                    else f"🛍️ Замовлення буде чекати на вас у закладі{time_part}!"
                )
                client_text = (
                    f"🎉 <b>Ваше замовлення #{order_id} підтверджено!</b>\n\n"
                    f"Ми вже розпочали приготування. 🍕✨\n"
                    f"{client_fulfillment}\n"
                    f"💵 Сума: {final_total:.2f} ₴"
                )
            elif new_status == "in_progress":
                client_text = (
                    f"👨‍🍳 <b>Замовлення #{order_id} готується!</b>\n\n"
                    f"Наші кухарі вже готують ваші улюблені страви на кухні."
                )
            elif new_status == "ready":
                if existing_fulfillment == "delivery":
                    client_text = (
                        f"🛵 <b>Замовлення #{order_id} готове та передано кур'єру!</b>\n\n"
                        f"Кур'єр уже прямує за адресою: <code>{esc_addr}</code> 💨"
                    )
                else:
                    client_text = (
                        f"🛍️ <b>Замовлення #{order_id} готове до видачі!</b>\n\n"
                        f"Ваше замовлення чекає на вас у закладі. Завітайте забрати!"
                    )
            elif new_status == "completed":
                client_text = (
                    f"🏁 <b>Замовлення #{order_id} виконано!</b>\n\n"
                    f"Смачного! Дякуємо, що обираєте Doma. Будемо раді бачити вас знову! ❤️"
                )
            elif new_status == "rejected":
                client_text = (
                    f"😔 <b>Замовлення #{order_id} відхилено</b>\n\n"
                    f"На жаль, наразі ми не можемо виконати це замовлення. "
                    f"Менеджер закладу зателефонує вам для уточнення деталей."
                )
            elif new_status == "cancelled":
                client_text = (
                    f"🚫 <b>Замовлення #{order_id} скасовано</b>\n\n"
                    f"Ваше замовлення було скасовано менеджером закладу."
                )
            else:
                client_text = None

            if client_text:
                background_tasks.add_task(
                    _send_tg_order_notification,
                    settings.bot_token,
                    {
                        "chat_id": existing_tg_id,
                        "text": client_text,
                        "parse_mode": "HTML",
                    },
                )

    return await get_admin_order(order_id, pool, staff)


@router.post("/orders/{order_id}/notify")
async def notify_order_updated(
    order_id: int,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Надсилання оновленого чека / статусу замовлення клієнту в Telegram."""
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN не налаштовано")

    order = await get_admin_order(order_id, pool, staff)

    items_text_list = []
    for g in order.groups:
        for it in g.items:
            opts_str = ""
            if it.options:
                opts = ", ".join(
                    f"{html.escape(o.option_name)}" + (f" ×{o.qty}" if o.qty > 1 else "")
                    for o in it.options
                )
                opts_str = f"\n   <i>↳ {opts}</i>"
            p_name = html.escape(it.product_name)
            v_label = html.escape(it.variant_label)
            items_text_list.append(
                f"• <b>{p_name}</b> ({v_label}) × {it.qty} — {it.subtotal:.2f} ₴{opts_str}"
            )
    items_block = "\n".join(items_text_list)

    time_line = f"⏰ <b>Бажаний час:</b> {order.scheduled_time}\n" if order.scheduled_time else ""

    text = (
        f"📝 <b>Оновлення замовлення #{order.id}</b>\n\n"
        f"Менеджер оновив деталі вашого замовлення:\n"
        f"{time_line}"
        f"📋 <b>Позиції:</b>\n{items_block}\n\n"
        f"💵 <b>Разом до сплати: {order.total_price:.2f} ₴</b>"
    )

    payload = {
        "chat_id": order.telegram_id,
        "text": text,
        "parse_mode": "HTML",
    }

    background_tasks.add_task(
        _send_tg_order_notification,
        settings.bot_token,
        payload,
    )
    return {"status": "ok", "message": "Сповіщення надіслано клієнту"}


# ============================================================================
# 8. Керування довідником адрес доставки та стоплистом
# ============================================================================


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
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=400,
            detail=f"Адреса '{clean_street}' для міста '{clean_city}' вже існує",
        )
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
        SET {', '.join(updates)}
        WHERE id = $1
        RETURNING id, city, street, is_active, notes, sort_order, created_at, updated_at
    """
    try:
        row = await pool.fetchrow(sql, *params)
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=400,
            detail="Адреса з такою назвою для цього міста вже існує",
        )
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

