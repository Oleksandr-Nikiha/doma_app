import logging
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.services.telegram_client import fetch_bot_username

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/auth",
    tags=["admin-auth"],
    dependencies=[Depends(rate_limiter)],
)

_cached_bot_username: str | None = None


async def _get_bot_username(bot_token: str) -> str:
    global _cached_bot_username
    if _cached_bot_username:
        return _cached_bot_username
    try:
        settings = get_settings()
        if settings.bot_username and settings.bot_username != "domapizza_bot":
            _cached_bot_username = settings.bot_username
            return _cached_bot_username
    except Exception:
        pass
    try:
        username = await fetch_bot_username(bot_token)
        if username:
            _cached_bot_username = username
            return _cached_bot_username
    except Exception as e:
        logger.warning("Не вдалося автоматично визначити username бота: %s", e)
    return "ncoffee_app_tst_bot"


class AuthSessionOut(BaseModel):
    session_id: str
    bot_url: str
    tg_url: str | None = None
    code: str
    expires_in: int


class AuthStatusOut(BaseModel):
    status: str
    token: str | None = None
    error: str | None = None


def generate_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


@router.post("/session", response_model=AuthSessionOut)
async def create_auth_session(
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """Створює сесію авторизації в адмінку для входу з комп'ютера (дійсна 10 хв)."""
    session_id = uuid.uuid4()
    code = generate_code()
    expires_at = datetime.now(UTC) + timedelta(minutes=10)

    async with pool.acquire() as conn:
        # Автоматичне фонове очищення прострочених та використаних сесій (SEC-11)
        await conn.execute(
            """
            DELETE FROM admin_auth_sessions
            WHERE expires_at < now() - INTERVAL '1 hour'
               OR (status = 'consumed' AND created_at < now() - INTERVAL '1 day')
            """
        )

        await conn.execute(
            """
            INSERT INTO admin_auth_sessions (id, code, status, expires_at)
            VALUES ($1, $2, 'pending', $3)
            """,
            session_id,
            code,
            expires_at,
        )

    bot_username = await _get_bot_username(settings.bot_token)
    bot_url = f"https://t.me/{bot_username}?start=admin_{code}"
    tg_url = f"tg://resolve?domain={bot_username}&start=admin_{code}"

    return AuthSessionOut(
        session_id=str(session_id),
        bot_url=bot_url,
        tg_url=tg_url,
        code=code,
        expires_in=600,
    )


@router.get("/session/{session_id}", response_model=AuthStatusOut)
async def check_auth_session(
    session_id: uuid.UUID,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Опитування статусу сесії з фронтенду."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT status, token, expires_at
            FROM admin_auth_sessions
            WHERE id = $1
            """,
            session_id,
        )

        if not row:
            raise HTTPException(status_code=404, detail="Сесію не знайдено")

        now = datetime.now(UTC)
        if row["expires_at"] < now and row["status"] == "pending":
            return AuthStatusOut(status="expired", error="Час дії сесії вичерпано")

        token = row["token"] if row["status"] == "approved" else None

        # Захист: маркуємо схвалену сесію як 'consumed' після першого зчитування токена
        if row["status"] == "approved":
            await conn.execute(
                "UPDATE admin_auth_sessions SET status = 'consumed' WHERE id = $1",
                session_id,
            )

    return AuthStatusOut(
        status=row["status"],
        token=token,
    )
