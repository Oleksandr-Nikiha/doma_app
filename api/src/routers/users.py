import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import get_current_user, get_init_data
from src.config import get_settings
from src.db.connection import get_pool
from src.routers.admin_auth import _get_bot_username
from src.schemas.user import RegisterIn, UserOut, UserUpdateIn

router = APIRouter(prefix="/api", tags=["Users"])


def _user_to_out(row: asyncpg.Record | dict, bot_token: str | None = None) -> UserOut:
    d = dict(row)
    if not d.get("first_name"):
        parts = (d.get("full_name") or "").split(" ", 1)
        d["first_name"] = parts[0] if parts else ""
        d["last_name"] = parts[1] if len(parts) > 1 else None
    d["client_code"] = f"DM-{d['telegram_id']}"
    d["bonus_balance"] = 0
    if "is_phone_verified" not in d or d["is_phone_verified"] is None:
        d["is_phone_verified"] = False
    if bot_token:
        d["bot_username"] = _get_bot_username(bot_token)
    return UserOut(**d)


@router.post("/register", response_model=UserOut)
async def register_user(
    payload: RegisterIn,
    init_data: dict = Depends(get_init_data),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
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

    return _user_to_out(row, settings.bot_token)


@router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user), settings=Depends(get_settings)):
    """
    Повертає профіль поточного авторизованого користувача.
    """
    return _user_to_out(user, settings.bot_token)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Оновлює дані профілю: ім'я, прізвище, основну та додаткову адреси,
    а також номер телефону (якщо він ще не був верифікований або верифікацію знято).
    """
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip() if payload.last_name else None
    full_name = " ".join(filter(None, [first_name, last_name or ""]))
    deliv_addr = payload.delivery_address.strip() if payload.delivery_address else None
    add_addr = payload.additional_address.strip() if payload.additional_address else None

    updates = [
        "first_name = $1",
        "last_name = $2",
        "full_name = $3",
        "delivery_address = $4",
        "additional_address = $5",
    ]
    params = [first_name, last_name, full_name, deliv_addr, add_addr]

    if payload.phone is not None:
        if user["is_phone_verified"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Верифікований номер телефону не можна змінювати. "
                    "Зверніться до адміністратора закладу."
                ),
            )
        params.append(payload.phone)
        updates.append(f"phone = ${len(params)}")

    params.append(user["telegram_id"])
    query = f"""
        UPDATE users
        SET {', '.join(updates)},
            updated_at = now()
        WHERE telegram_id = ${len(params)}
        RETURNING *
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query,
            *params,
        )

    return _user_to_out(row, settings.bot_token)
