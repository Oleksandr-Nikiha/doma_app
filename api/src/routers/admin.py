import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth.deps import get_current_admin, get_current_staff, get_current_user
from src.db.connection import get_pool
from src.schemas.admin import (
    AdminMeOut,
    AvailabilityUpdateIn,
    CategoryAdminOut,
    CategoryCreateIn,
    CategoryUpdateIn,
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
    _: asyncpg.Record = Depends(get_current_admin),
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
    _: asyncpg.Record = Depends(get_current_admin),
):
    """Призначення користувача менеджером або адміном."""
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
    current_admin: asyncpg.Record = Depends(get_current_admin),
):
    """Оновлення ролі, закладу або статусу активності менеджера."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, telegram_id, role FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")

        if existing["telegram_id"] == current_admin["telegram_id"] and data.is_active is False:
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
    current_admin: asyncpg.Record = Depends(get_current_admin),
):
    """Видалення менеджера зі штату."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT telegram_id FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")
        if existing["telegram_id"] == current_admin["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити самого себе")

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
    if staff["role"] == "manager" and staff["location_id"] and data.location_id != staff["location_id"]:
        raise HTTPException(status_code=403, detail="Ви можете додавати категорії лише для свого закладу")

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

        if staff["role"] == "manager" and staff["location_id"] and cat["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and cat["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and cat["location_id"] != staff["location_id"]:
            raise HTTPException(status_code=403, detail="Немає доступу до цієї категорії")

        p_row = await conn.fetchrow(
            """
            INSERT INTO products (category_id, name, description, image_url, sort_order, is_available)
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
                INSERT INTO product_variants (product_id, label, price, weight, sort_order, is_available)
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

        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
            raise HTTPException(status_code=403, detail="Немає доступу")

        row = await conn.fetchrow(
            """
            INSERT INTO product_variants (product_id, label, price, weight, sort_order, is_available)
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

        if staff["role"] == "manager" and staff["location_id"] and v["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and v["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
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

        if staff["role"] == "manager" and staff["location_id"] and v["location_id"] != staff["location_id"]:
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
            INSERT INTO option_group_items (group_id, variant_id, price_delta, sort_order, is_available)
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


@router.patch("/option-groups/{group_id}/items/{variant_id}", response_model=OptionGroupItemAdminOut)
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
            await conn.execute(
                f"UPDATE option_group_items SET {', '.join(updates)} WHERE group_id = $1 AND variant_id = $2",
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
        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
            raise HTTPException(status_code=403, detail="Немає доступу до страви іншого закладу")

        group = await conn.fetchrow("SELECT name FROM option_groups WHERE id = $1", data.group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Групу додатків не знайдено")

        if data.min_select < 0 or data.max_select < data.min_select:
            raise HTTPException(status_code=400, detail="Некоректні ліміти: max_select повинен бути >= min_select >= 0")

        row = await conn.fetchrow(
            """
            INSERT INTO product_option_groups (product_id, group_id, min_select, max_select, free_count, sort_order)
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


@router.patch("/products/{product_id}/option-groups/{group_id}", response_model=ProductOptionGroupAdminOut)
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
        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
            raise HTTPException(status_code=403, detail="Немає доступу")

        existing = await conn.fetchrow(
            """
            SELECT pog.min_select, pog.max_select, pog.free_count, pog.sort_order, g.name AS group_name
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
            raise HTTPException(status_code=400, detail="max_select повинен бути >= min_select >= 0")

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
        if staff["role"] == "manager" and staff["location_id"] and p["location_id"] != staff["location_id"]:
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