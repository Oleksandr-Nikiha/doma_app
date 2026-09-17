import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import get_current_user, get_init_data
from src.db.connection import get_pool
from src.schemas.user import RegisterIn, UserOut, UserUpdateIn

router = APIRouter(prefix="/api", tags=["Users"])


def _user_to_out(row: asyncpg.Record | dict) -> UserOut:
    d = dict(row)
    if not d.get("first_name"):
        parts = (d.get("full_name") or "").split(" ", 1)
        d["first_name"] = parts[0] if parts else ""
        d["last_name"] = parts[1] if len(parts) > 1 else None
    d["client_code"] = f"DM-{d['telegram_id']}"
    d["bonus_balance"] = 0
    return UserOut(**d)


@router.post("/register", response_model=UserOut)
async def register_user(
    payload: RegisterIn,
    init_data: dict = Depends(get_init_data),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Реєструє нового користувача.
    Бере telegram_id з валідованих даних Telegram,
    а решту даних (ім'я, телефон, адреса) — з тіла запиту.
    """
    telegram_id = init_data.get("user", {}).get("id")

    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не вдалося отримати telegram_id з даних авторизації",
        )

    first_name = payload.first_name or (
        payload.full_name.split(" ", 1)[0] if payload.full_name else ""
    )
    last_name = payload.last_name or (
        payload.full_name.split(" ", 1)[1] if len(payload.full_name.split(" ", 1)) > 1 else None
    )
    full_name = payload.full_name or " ".join(filter(None, [first_name, last_name or ""]))

    query = """
        INSERT INTO users (telegram_id, full_name, first_name, last_name, phone, delivery_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (telegram_id) DO UPDATE 
        SET full_name = EXCLUDED.full_name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone = EXCLUDED.phone,
            delivery_address = EXCLUDED.delivery_address,
            updated_at = now()
        RETURNING *
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query,
            telegram_id,
            full_name,
            first_name,
            last_name,
            payload.phone,
            payload.delivery_address,
        )

    return _user_to_out(row)


@router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user)):
    """
    Повертає профіль поточного авторизованого користувача.
    """
    return _user_to_out(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Оновлює дані профілю: ім'я, прізвище, основну та додаткову адреси.
    Номер телефону зафіксований і зміні не підлягає.
    """
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip() if payload.last_name else None
    full_name = " ".join(filter(None, [first_name, last_name or ""]))
    deliv_addr = payload.delivery_address.strip() if payload.delivery_address else None
    add_addr = payload.additional_address.strip() if payload.additional_address else None

    query = """
        UPDATE users
        SET first_name = $1,
            last_name = $2,
            full_name = $3,
            delivery_address = $4,
            additional_address = $5,
            updated_at = now()
        WHERE telegram_id = $6
        RETURNING *
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query,
            first_name,
            last_name,
            full_name,
            deliv_addr,
            add_addr,
            user["telegram_id"],
        )

    return _user_to_out(row)
