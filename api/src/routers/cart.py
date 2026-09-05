import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_user
from src.db.connection import get_pool
from src.schemas.cart import CartItemIn, CartItemOut, CartItemUpdateIn, CartOut

router = APIRouter(prefix="/api/cart", tags=["Cart"])

async def _fetch_cart(pool: asyncpg.Pool, telegram_id: int) -> CartOut:
    """
    Витягує кошик разом із вибраними опціями.
    Додає вартість опцій до subtotal за допомогою агрегації в БД.
    """
    query = """
        SELECT
            ci.id,
            p.id AS product_id,
            p.name AS product_name,
            pv.label AS variant_label,
            pv.weight,
            pv.price AS price,
            ci.qty,
            (pv.price + COALESCE(SUM(ogi.price_delta * cio.qty), 0)) * ci.qty AS subtotal,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'group_id', cio.group_id,
                        'variant_id', cio.variant_id,
                        'name', opt_p.name,               -- Назва (напр. "Кетчуп")
                        'label', opt_pv.label,            -- Варіант (напр. "50 г")
                        'price_delta', ogi.price_delta,
                        'qty', cio.qty
                    )
                ) FILTER (WHERE cio.cart_item_id IS NOT NULL), '[]'::jsonb
            ) AS options
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN carts c ON c.id = ci.cart_id
        LEFT JOIN cart_item_options cio ON cio.cart_item_id = ci.id
        LEFT JOIN option_group_items ogi
               ON ogi.group_id = cio.group_id AND ogi.variant_id = cio.variant_id
        LEFT JOIN product_variants opt_pv ON opt_pv.id = cio.variant_id
        LEFT JOIN products opt_p ON opt_p.id = opt_pv.product_id
        WHERE c.telegram_id = $1
        GROUP BY ci.id, p.id, pv.id
        ORDER BY ci.id
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, telegram_id)

    items = []
    total = 0.0
    for row in rows:
        row_dict = dict(row)
        
        if isinstance(row_dict["options"], str):
            row_dict["options"] = json.loads(row_dict["options"])
            
        items.append(CartItemOut(**row_dict))
        total += float(row_dict["subtotal"])

    return CartOut(items=items, total=total)


@router.get("", response_model=CartOut)
async def get_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """Отримує вміст кошика для поточного користувача."""
    return await _fetch_cart(pool, user["telegram_id"])


@router.post("/items", response_model=CartOut)
async def add_item_to_cart(
    payload: CartItemIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):

    seen_opts = set()
    for opt in payload.options:
        pair = (opt.group_id, opt.variant_id)
        if pair in seen_opts:
            raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
        seen_opts.add(pair)
        
    async with pool.acquire() as conn, conn.transaction():
        variant = await conn.fetchrow("""
            SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = $1
        """, payload.variant_id)
        
        if not variant:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")
        if not variant["p_avail"] or not variant["pv_avail"]:
            raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

        product_id = variant["product_id"]

        groups = await conn.fetch("""
            SELECT group_id, min_select, max_select 
            FROM product_option_groups 
            WHERE product_id = $1
        """, product_id)
        group_rules = {row["group_id"]: row for row in groups}

        requested_groups = {}
        for opt in payload.options:
            if opt.group_id not in group_rules:
                raise HTTPException(
                    status_code=400,
                    detail=f"Група {opt.group_id} не належить товару",
                )
            requested_groups.setdefault(opt.group_id, []).append(opt.variant_id)

        for g_id, rule in group_rules.items():
            count = len(requested_groups.get(g_id, []))
            if count < rule["min_select"] or count > rule["max_select"]:
                raise HTTPException(
                    status_code=400, 
                    detail=(
                        f"Група {g_id}: вибрано {count}, "
                        f"дозволено {rule['min_select']}-{rule['max_select']}"
                    ),
                )

        if payload.options:
            allowed_opts = await conn.fetch("""
                SELECT group_id, variant_id 
                FROM option_group_items 
                WHERE group_id = ANY($1) AND is_available = true
            """, list(group_rules.keys()))
            allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}
            
            for opt in payload.options:
                if (opt.group_id, opt.variant_id) not in allowed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                    )

        sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
        options_key = "|".join([f"{o.group_id}:{o.variant_id}" for o in sorted_opts])

        cart_id = await conn.fetchval("""
            INSERT INTO carts (telegram_id) VALUES ($1)
            ON CONFLICT (telegram_id) DO UPDATE SET telegram_id = EXCLUDED.telegram_id
            RETURNING id
        """, user["telegram_id"])

        upsert_query = """
            INSERT INTO cart_items (cart_id, variant_id, qty, options_key)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cart_id, variant_id, options_key) DO UPDATE
            SET qty = cart_items.qty + EXCLUDED.qty
            RETURNING id, (xmax = 0) AS is_insert
        """
        row = await conn.fetchrow(
            upsert_query, cart_id, payload.variant_id, payload.qty, options_key
        )
        cart_item_id = row["id"]

        if row["is_insert"] and sorted_opts:
            opts_data = [(cart_item_id, o.group_id, o.variant_id) for o in sorted_opts]
            await conn.executemany("""
                INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                VALUES ($1, $2, $3, 1)
            """, opts_data)

    return await _fetch_cart(pool, user["telegram_id"])

@router.patch("/items/{item_id}", response_model=CartOut)
async def update_cart_item(
    item_id: int,
    payload: CartItemUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Оновлює кількість конкретного товару в кошику (наприклад, +1 / -1).
    """
    update_query = """
        UPDATE cart_items
        SET qty = $1
        FROM carts
        WHERE cart_items.cart_id = carts.id
          AND cart_items.id = $2
          AND carts.telegram_id = $3
    """
    async with pool.acquire() as conn:
        # execute повертає рядок статусу, наприклад "UPDATE 1" або "UPDATE 0"
        result = await conn.execute(update_query, payload.qty, item_id, user["telegram_id"])
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

    return await _fetch_cart(pool, user["telegram_id"])


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_cart_item(
    item_id: int,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Видаляє товар з кошика.
    """
    delete_query = """
        DELETE FROM cart_items
        USING carts
        WHERE cart_items.cart_id = carts.id
          AND cart_items.id = $1
          AND carts.telegram_id = $2
    """
    async with pool.acquire() as conn:
        result = await conn.execute(delete_query, item_id, user["telegram_id"])

        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

    return await _fetch_cart(pool, user["telegram_id"])


@router.delete("", response_model=CartOut)
async def clear_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Повністю очищає кошик. Сам кошик (`carts`) не видаляємо — лише позиції,
    щоб не смикати get_or_create_cart_id при наступному додаванні.
    Порожній кошик — не помилка, тож 404 тут не кидаємо.
    """
    clear_query = """
        DELETE FROM cart_items
        USING carts
        WHERE cart_items.cart_id = carts.id
          AND carts.telegram_id = $1
    """
    async with pool.acquire() as conn:
        await conn.execute(clear_query, user["telegram_id"])

    return await _fetch_cart(pool, user["telegram_id"])