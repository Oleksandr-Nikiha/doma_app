import hashlib
import hmac
import json
import os
import time
import urllib.parse
from unittest.mock import AsyncMock, MagicMock

import asyncpg
import httpx
import pytest

# Задаємо змінні середовища до імпорту застосунку, щоб конфіг завжди ініціалізувався
os.environ.setdefault("DATABASE_URL", "postgresql://test_user:test_pass@localhost:5432/test_db")
os.environ.setdefault("BOT_TOKEN", "123456:test_bot_token_sample")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("CATALOG_CACHE_ENABLED", "true")
os.environ.setdefault("RATE_LIMIT_ENABLED", "true")

from src.auth.admin_token import create_admin_token
from src.auth.deps import get_current_user, get_pool
from src.config import get_settings
from src.main import app


def build_test_init_data(
    user_id: int = 123456789,
    first_name: str = "Тестовий",
    last_name: str = "Юзер",
    username: str = "testuser",
    bot_token: str | None = None,
    auth_date: int | None = None,
) -> str:
    """Динамічно генерує валідний підписаний Telegram initData рядок."""
    token = bot_token or get_settings().bot_token
    date_val = auth_date if auth_date is not None else int(time.time())
    user_dict = {
        "id": user_id,
        "first_name": first_name,
        "last_name": last_name,
        "username": username,
        "language_code": "uk",
    }
    pairs = [
        ("auth_date", str(date_val)),
        ("query_id", "AAHdF6IQAAAAAN0XohD12345"),
        ("user", json.dumps(user_dict, separators=(",", ":"), ensure_ascii=False)),
    ]
    pairs_sorted = sorted(pairs, key=lambda x: x[0])
    check_string = "\n".join(f"{k}={v}" for k, v in pairs_sorted)

    secret_key = hmac.new(b"WebAppData", token.encode("utf-8"), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    encoded_pairs = [(k, v) for k, v in pairs] + [("hash", calc_hash)]
    return urllib.parse.urlencode(encoded_pairs)


@pytest.fixture
def test_bot_token() -> str:
    return get_settings().bot_token


@pytest.fixture
def valid_init_data(test_bot_token) -> str:
    return build_test_init_data(bot_token=test_bot_token)


@pytest.fixture
def valid_admin_token(test_bot_token) -> str:
    return create_admin_token(telegram_id=999999999, secret_key=test_bot_token)


@pytest.fixture
def test_user_data() -> dict:
    return {
        "id": 1,
        "telegram_id": 123456789,
        "full_name": "Тестовий Юзер",
        "first_name": "Тестовий",
        "last_name": "Юзер",
        "phone": "+380931112233",
        "is_phone_verified": True,
        "is_blocked": False,
        "delivery_address": "м. Вишгород, вул. Київська, 10",
        "additional_address": None,
        "client_code": "CLI-1001",
        "bonus_balance": 50,
        "bot_username": "ncoffee_app_tst_bot",
    }


class AsyncContextManagerMock:
    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return None


@pytest.fixture
def mock_db_conn():
    conn = AsyncMock(spec=asyncpg.Connection)
    conn.transaction = MagicMock(return_value=AsyncContextManagerMock(conn))
    return conn


@pytest.fixture
def mock_db_pool(mock_db_conn):
    pool = AsyncMock(spec=asyncpg.Pool)
    pool.acquire = MagicMock(return_value=AsyncContextManagerMock(mock_db_conn))
    return pool


@pytest.fixture
async def async_client(mock_db_pool, test_user_data):
    """
    HTTPX клієнт для виклику ендпоінтів з перекриттям залежностей БД та користувача.
    """
    app.dependency_overrides[get_pool] = lambda: mock_db_pool
    app.dependency_overrides[get_current_user] = lambda: test_user_data

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
