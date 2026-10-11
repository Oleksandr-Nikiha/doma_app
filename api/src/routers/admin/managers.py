import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import get_current_admin, get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    ManagerCreateIn,
    ManagerOut,
    ManagerUpdateIn,
)

router = APIRouter()

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
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Призначення користувача менеджером або адміном (тільки для головного адміністратора)."""

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
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Оновлення менеджера (тільки для головного адміністратора)."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, telegram_id, role FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")

        if existing["telegram_id"] == admin["telegram_id"] and data.is_active is False:
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
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Видалення менеджера зі штату (тільки для головного адміністратора)."""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT telegram_id, role FROM managers WHERE id = $1", manager_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Менеджера не знайдено")

        if existing["telegram_id"] == admin["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")

        await conn.execute("DELETE FROM managers WHERE id = $1", manager_id)
    return {"status": "ok", "message": "Менеджера успішно видалено"}
