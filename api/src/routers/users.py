import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.auth.deps import get_current_user, get_init_data
from src.auth.telegram_widget import validate_telegram_widget_data
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.user import RegisterIn, UserOut, UserUpdateIn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Users"], dependencies=[Depends(rate_limiter)])


class TelegramWidgetAuthIn(BaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str



def _user_to_out(
    row: asyncpg.Record | dict,
    bot_token: str | None = None,
    generate_token: bool = False,
) -> UserOut:
    d = dict(row)
    if not d.get("first_name"):
        parts = (d.get("full_name") or "").split(" ", 1)
        d["first_name"] = parts[0] if parts else ""
        d["last_name"] = parts[1] if len(parts) > 1 else None
    user_num = d.get("telegram_id") or d.get("id") or 0
    d["client_code"] = f"DM-{user_num}"
    d["bonus_balance"] = 0
    if "is_phone_verified" not in d or d["is_phone_verified"] is None:
        d["is_phone_verified"] = False
    settings = get_settings()
    d["bot_username"] = (
        getattr(settings, "bot_username", "ncoffee_app_tst_bot") or "ncoffee_app_tst_bot"
    )
    if generate_token and d.get("id") and settings.bot_token:
        from src.auth.admin_token import create_user_token

        d["auth_token"] = create_user_token(d["id"], settings.bot_token)
    return UserOut(**d)



@router.post("/auth/telegram-widget", response_model=UserOut)
async def auth_telegram_widget(
    payload: TelegramWidgetAuthIn,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Авторизація клієнта через офіційний Telegram Login Widget на публічному веб-сайті.
    Знаходить або створює обліковий запис у таблиці users та проставляє верифікацію.
    """
    try:
        validate_telegram_widget_data(payload.model_dump(), settings.bot_token)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Помилка авторизації Telegram: {e}",
        ) from e

    telegram_id = payload.id
    first_name = payload.first_name or ""
    last_name = payload.last_name or ""
    full_name = " ".join(filter(None, [first_name, last_name])) or f"Гість #{telegram_id}"

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            """
            SELECT id, telegram_id, full_name, first_name, last_name, phone,
                   delivery_address, additional_address, is_phone_verified
            FROM users
            WHERE telegram_id = $1
            """,
            telegram_id,
        )

        if existing:
            await conn.execute(
                """
                UPDATE users
                SET first_name = CASE
                        WHEN first_name = '' OR first_name IS NULL THEN $1
                        ELSE first_name
                    END,
                    last_name = CASE
                        WHEN last_name = '' OR last_name IS NULL THEN $2
                        ELSE last_name
                    END,
                    full_name = CASE
                        WHEN full_name = '' OR full_name LIKE 'Гість%' THEN $3
                        ELSE full_name
                    END,
                    is_phone_verified = true,
                    updated_at = now()
                WHERE telegram_id = $4
                """,
                first_name,
                last_name,
                full_name,
                telegram_id,
            )
            existing = await conn.fetchrow(
                """
                SELECT id, telegram_id, full_name, first_name, last_name, phone,
                       delivery_address, additional_address, is_phone_verified
                FROM users
                WHERE telegram_id = $1
                """,
                telegram_id,
            )
            return _user_to_out(existing, settings.bot_token, generate_token=True)

        new_row = await conn.fetchrow(
            """
            INSERT INTO users (
                telegram_id, full_name, first_name, last_name, phone, is_phone_verified
            )
            VALUES ($1, $2, $3, $4, '', true)
            RETURNING id, telegram_id, full_name, first_name, last_name, phone,
                      delivery_address, additional_address, is_phone_verified
            """,
            telegram_id,
            full_name,
            first_name,
            last_name,
        )
        return _user_to_out(new_row, settings.bot_token, generate_token=True)



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

    async with pool.acquire() as conn:
        # Захист SEC-03: верифікований номер не можна підміняти через повторну реєстрацію
        existing_user = await conn.fetchrow(
            "SELECT is_phone_verified, phone FROM users WHERE telegram_id = $1",
            telegram_id,
        )
        if (
            existing_user
            and existing_user["is_phone_verified"]
            and payload.phone.strip() != existing_user["phone"]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Верифікований номер телефону не можна змінювати. "
                    "Зверніться до адміністратора закладу."
                ),
            )

        query = """
            INSERT INTO users (
                telegram_id, full_name, first_name, last_name,
                phone, delivery_address, is_phone_verified
            )
            VALUES ($1, $2, $3, $4, $5, $6, true)
            ON CONFLICT (telegram_id) DO UPDATE 
            SET full_name = EXCLUDED.full_name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone = EXCLUDED.phone,
                delivery_address = EXCLUDED.delivery_address,
                is_phone_verified = true,
                updated_at = now()
            RETURNING *
        """
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
        SET {", ".join(updates)},
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


class WebProfileUpdateIn(BaseModel):
    telegram_id: int | None = None
    phone: str | None = None
    full_name: str | None = None
    delivery_address: str | None = None
    additional_address: str | None = None


@router.get("/auth/web-profile", response_model=UserOut)
async def get_web_profile(
    telegram_id: int | None = None,
    phone: str | None = None,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Отримання актуальних даних профілю з бази даних за telegram_id або номером телефону.
    Використовується веб-клієнтом для синхронізації верифікації, імені та збережених адрес.
    """
    if not telegram_id and not phone:
        raise HTTPException(
            status_code=400,
            detail="Вкажіть telegram_id або номер телефону для пошуку профілю",
        )

    norm_phone = None
    if phone:
        from src.schemas.user import normalize_phone

        try:
            norm_phone = normalize_phone(phone)
        except ValueError:
            norm_phone = phone.strip()

    async with pool.acquire() as conn:
        user = None
        if telegram_id:
            user = await conn.fetchrow(
                """
                SELECT id, telegram_id, full_name, first_name, last_name, phone,
                       delivery_address, additional_address, is_phone_verified
                FROM users
                WHERE telegram_id = $1
                """,
                telegram_id,
            )
        elif norm_phone:
            user = await conn.fetchrow(
                """
                SELECT id, telegram_id, full_name, first_name, last_name, phone,
                       delivery_address, additional_address, is_phone_verified
                FROM users
                WHERE phone = $1
                ORDER BY is_phone_verified DESC, id ASC
                LIMIT 1
                """,
                norm_phone,
            )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="Користувача не знайдено",
            )

        return _user_to_out(user, settings.bot_token)


@router.post("/auth/web-profile", response_model=UserOut)
async def update_web_profile(
    payload: WebProfileUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Оновлення контактних даних користувача з публічного веб-сайту.
    Синхронізує телефон, ім'я та адресу з таблицею users для вказаного telegram_id або телефону,
    автоматично підтверджуючи номер, якщо користувач авторизований через Telegram.
    """
    telegram_id = payload.telegram_id
    clean_phone = payload.phone.strip() if payload.phone else None
    clean_name = payload.full_name.strip() if payload.full_name else None
    clean_addr = payload.delivery_address.strip() if payload.delivery_address else None
    clean_add_addr = payload.additional_address.strip() if payload.additional_address else None

    if not telegram_id and not clean_phone:
        raise HTTPException(
            status_code=400,
            detail="Вкажіть telegram_id або номер телефону для збереження профілю",
        )

    norm_phone = None
    if clean_phone:
        from src.schemas.user import normalize_phone

        try:
            norm_phone = normalize_phone(clean_phone)
        except ValueError:
            norm_phone = clean_phone

    async with pool.acquire() as conn:
        existing = None
        if telegram_id:
            existing = await conn.fetchrow(
                """
                SELECT id, telegram_id, full_name, first_name, last_name, phone,
                       delivery_address, additional_address, is_phone_verified
                FROM users
                WHERE telegram_id = $1
                """,
                telegram_id,
            )
        elif norm_phone:
            existing = await conn.fetchrow(
                """
                SELECT id, telegram_id, full_name, first_name, last_name, phone,
                       delivery_address, additional_address, is_phone_verified
                FROM users
                WHERE phone = $1
                ORDER BY is_phone_verified DESC, id ASC
                LIMIT 1
                """,
                norm_phone,
            )

        if not existing:
            first_name = clean_name.split(" ", 1)[0] if clean_name else ""
            last_name = clean_name.split(" ", 1)[1] if clean_name and " " in clean_name else ""
            new_row = await conn.fetchrow(
                """
                INSERT INTO users (
                    telegram_id, full_name, first_name, last_name,
                    phone, delivery_address, additional_address, is_phone_verified
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, telegram_id, full_name, first_name, last_name, phone,
                          delivery_address, additional_address, is_phone_verified
                """,
                telegram_id,
                clean_name or (f"Гість #{telegram_id}" if telegram_id else "Клієнт"),
                first_name,
                last_name,
                norm_phone or "",
                clean_addr,
                clean_add_addr,
                bool(telegram_id),
            )
            return _user_to_out(new_row, settings.bot_token)

        user_id = existing["id"]
        is_verified = bool(existing["is_phone_verified"] or telegram_id)
        first_name = clean_name.split(" ", 1)[0] if clean_name else existing["first_name"]
        last_name = (
            clean_name.split(" ", 1)[1]
            if clean_name and " " in clean_name
            else existing["last_name"]
        )

        updated_row = await conn.fetchrow(
            """
            UPDATE users
            SET phone = COALESCE($1, phone),
                full_name = COALESCE($2, full_name),
                first_name = COALESCE($3, first_name),
                last_name = COALESCE($4, last_name),
                delivery_address = COALESCE($5, delivery_address),
                additional_address = COALESCE($6, additional_address),
                telegram_id = COALESCE($7, telegram_id),
                is_phone_verified = $8,
                updated_at = now()
            WHERE id = $9
            RETURNING id, telegram_id, full_name, first_name, last_name, phone,
                      delivery_address, additional_address, is_phone_verified
            """,
            norm_phone,
            clean_name,
            first_name,
            last_name,
            clean_addr,
            clean_add_addr,
            telegram_id,
            is_verified,
            user_id,
        )
        return _user_to_out(updated_row, settings.bot_token)




