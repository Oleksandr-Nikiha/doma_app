import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_user
from src.db.cart_repo import get_or_create_cart_id
from src.db.connection import get_pool
from src.schemas.cart import CartItemIn, CartItemOut, CartItemUpdateIn, CartOut

router = APIRouter(prefix="/api/cart", tags=["Cart"])

async def _fetch_cart(pool: asyncpg.Pool, telegram_id: int) -> CartOut:
    """
    Приватна функція для отримання актуального стану кошика з бази даних.
    Використовується в усіх ендпоінтах для повернення оновлених даних.
    """
    query = """
        SELECT
            ci.id,
            p.id AS product_id,
            p.name AS product_name,
            pv.label AS variant_label,
            pv.weight,
            pv.price,
            ci.qty,
            (pv.price * ci.qty) AS subtotal
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN carts c ON c.id = ci.cart_id
        WHERE c.telegram_id = $1
        ORDER BY ci.id
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, telegram_id)

    items = []
    total = 0.0
    for row in rows:
        row_dict = dict(row)
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
    """Додає товар у кошик. Якщо товар вже є — збільшує його кількість."""
    upsert_query = """
        INSERT INTO cart_items (cart_id, variant_id, qty)
        VALUES ($1, $2, $3)
        ON CONFLICT (cart_id, variant_id) DO UPDATE
        SET qty = cart_items.qty + EXCLUDED.qty
    """
    async with pool.acquire() as conn:
        # Перевіряємо варіант заздалегідь, щоб віддати 404 замість
        # 500 від порушення зовнішнього ключа.
        variant_exists = await conn.fetchval(
            "SELECT 1 FROM product_variants WHERE id = $1", payload.variant_id
        )
        if not variant_exists:
            raise HTTPException(status_code=404, detail="Варіант товару не знайдено")

        cart_id = await get_or_create_cart_id(pool, user["telegram_id"])
        await conn.execute(upsert_query, cart_id, payload.variant_id, payload.qty)

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