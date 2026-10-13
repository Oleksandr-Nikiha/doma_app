import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from src.auth.deps import get_current_admin
from src.db.connection import get_pool
from src.schemas.admin import (
    AdminUserOut,
    AdminUserUpdateIn,
)

router = APIRouter()


@router.get("/users", response_model=list[AdminUserOut])
async def list_admin_users(
    query: str = Query("", description="Пошук за номером телефону або ПІБ"),
    limit: int = Query(50, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Пошук клієнтів за номером телефону або ПІБ."""
    clean_q = query.strip()
    sql = """
        SELECT u.id, u.telegram_id, u.full_name, u.phone, u.delivery_address,
               u.is_blocked, u.is_phone_verified, u.admin_note,
               to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               COUNT(o.id)::int AS orders_count
        FROM users u
        LEFT JOIN orders o ON (
            (u.telegram_id IS NOT NULL AND o.telegram_id = u.telegram_id)
            OR (u.telegram_id IS NULL AND u.phone <> '' AND o.contact_phone = u.phone)
        )
        WHERE (
            $1 = ''
            OR u.phone ILIKE '%' || $1 || '%'
            OR u.full_name ILIKE '%' || $1 || '%'
            OR (u.telegram_id IS NOT NULL AND u.telegram_id::text ILIKE '%' || $1 || '%')
        )
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
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Оновлення статусу блокування, верифікації телефону та примітки про клієнта."""
    updates = []
    params = [user_id]

    if data.is_blocked is not None:
        params.append(data.is_blocked)
        updates.append(f"is_blocked = ${len(params)}")

    if data.admin_note is not None:
        params.append(data.admin_note.strip() if data.admin_note else None)
        updates.append(f"admin_note = ${len(params)}")

    if data.is_phone_verified is not None:
        params.append(data.is_phone_verified)
        updates.append(f"is_phone_verified = ${len(params)}")

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
                   u.is_blocked, u.is_phone_verified, u.admin_note,
                   to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   COUNT(o.id)::int AS orders_count
            FROM users u
            LEFT JOIN orders o ON (
                (u.telegram_id IS NOT NULL AND o.telegram_id = u.telegram_id)
                OR (u.telegram_id IS NULL AND u.phone <> '' AND o.contact_phone = u.phone)
            )
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
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Видалення користувача (тільки для ролі admin)."""
    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchrow("SELECT id, telegram_id FROM users WHERE id = $1", user_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        if existing["telegram_id"] is not None and existing["telegram_id"] == admin["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")

        if existing["telegram_id"] is not None:
            tg_id = existing["telegram_id"]
            await conn.execute("DELETE FROM managers WHERE telegram_id = $1", tg_id)
            await conn.execute("DELETE FROM carts WHERE telegram_id = $1", tg_id)
            await conn.execute("DELETE FROM orders WHERE telegram_id = $1", tg_id)
        await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    return {"status": "ok", "message": "Користувача успішно видалено"}
