import json
import logging
import secrets
import string
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.config import get_settings
from src.db.connection import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

_cached_bot_username: str | None = None


def _get_bot_username(bot_token: str) -> str:
    global _cached_bot_username
    if _cached_bot_username:
        return _cached_bot_username
    try:
        url = f"https://api.telegram.org/bot{bot_token}/getMe"
        req = urllib.request.Request(url, headers={"User-Agent": "FastAPI"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if data.get("ok") and "username" in data["result"]:
                _cached_bot_username = data["result"]["username"]
                return _cached_bot_username
    except Exception as e:
        logger.warning("Не вдалося автоматично визначити username бота: %s", e)
    return "domapizza_bot"


class AuthSessionOut(BaseModel):
    session_id: str
    bot_url: str
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
        await conn.execute(
            """
            INSERT INTO admin_auth_sessions (id, code, status, expires_at)
            VALUES ($1, $2, 'pending', $3)
            """,
            session_id,
            code,
            expires_at,
        )

    bot_username = _get_bot_username(settings.bot_token)
    bot_url = f"https://t.me/{bot_username}?start=admin_{session_id}"

    return AuthSessionOut(
        session_id=str(session_id),
        bot_url=bot_url,
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

    return AuthStatusOut(
        status=row["status"],
        token=row["token"] if row["status"] == "approved" else None,
    )
