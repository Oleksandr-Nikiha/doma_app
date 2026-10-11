import time

import pytest
from fastapi import HTTPException

from src.auth.admin_token import create_admin_token, verify_admin_token
from src.auth.deps import get_current_user, get_init_data, require_telegram_or_staff
from src.auth.telegram_init_data import validate_init_data
from tests.conftest import build_test_init_data


class TestTelegramInitDataValidation:
    """Тестування перевірки підпису Telegram initData (HMAC-SHA256)."""

    def test_valid_init_data_success(self, test_bot_token):
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token)
        parsed = validate_init_data(raw_data, bot_token=test_bot_token)

        assert "user" in parsed
        assert parsed["user"]["id"] == 12345
        assert parsed["user"]["first_name"] == "Тестовий"

    def test_missing_hash_raises_value_error(self, test_bot_token):
        raw_data = "user=%7B%22id%22%3A123%7D&auth_date=1700000000"
        with pytest.raises(ValueError, match="Відсутній параметр 'hash'"):
            validate_init_data(raw_data, bot_token=test_bot_token)

    def test_invalid_hash_signature_mismatch(self, test_bot_token):
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token)
        # Підміняємо хеш
        tampered = raw_data[:-10] + "0123456789"
        with pytest.raises(ValueError, match="Невалідний підпис: hash не співпадає"):
            validate_init_data(tampered, bot_token=test_bot_token)

    def test_missing_auth_date_raises_value_error(self, test_bot_token):
        # Якщо немає auth_date
        with pytest.raises(ValueError):
            validate_init_data("query_id=123&hash=abc", bot_token=test_bot_token)

    def test_expired_init_data_raises_value_error(self, test_bot_token):
        # auth_date 2 дні тому
        old_date = int(time.time()) - (2 * 86400)
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token, auth_date=old_date)

        with pytest.raises(ValueError, match="Дані застаріли"):
            validate_init_data(raw_data, bot_token=test_bot_token, max_age_seconds=86400)


class TestAdminTokenSecurity:
    """Тестування генерації та верифікації токенів адміністратора."""

    def test_create_and_verify_admin_token_success(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token, days=7)
        tg_id = verify_admin_token(token, secret_key=test_bot_token)
        assert tg_id == 987654321

    def test_expired_admin_token_returns_none(self, test_bot_token):
        # Токен із минулим строком дії (-1 день)
        expired_token = create_admin_token(
            telegram_id=987654321, secret_key=test_bot_token, days=-1
        )
        assert verify_admin_token(expired_token, secret_key=test_bot_token) is None

    def test_tampered_token_returns_none(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token)
        # Змінюємо telegram_id у токені
        parts = token.split(".")
        parts[1] = "111111111"
        tampered_token = ".".join(parts)
        assert verify_admin_token(tampered_token, secret_key=test_bot_token) is None

    def test_wrong_secret_key_returns_none(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token)
        assert verify_admin_token(token, secret_key="wrong_secret_key") is None

    def test_malformed_token_returns_none(self, test_bot_token):
        assert verify_admin_token("invalid.token", secret_key=test_bot_token) is None
        assert verify_admin_token("", secret_key=test_bot_token) is None


class TestAuthDependencies:
    """Тестування FastApi dependencies авторизації."""

    async def test_get_init_data_missing_header_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_init_data(init_data_raw=None)
        assert exc_info.value.status_code == 401
        assert "Відсутній заголовок X-Telegram-Init-Data" in exc_info.value.detail

    async def test_require_telegram_or_staff_blocks_unauthorized(self, test_bot_token):
        """Прямий доступ без заголовків викликає 403 (SEC-5)."""
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        with pytest.raises(HTTPException) as exc_info:
            await require_telegram_or_staff(
                init_data_raw=None,
                admin_token_raw=None,
                settings=settings_mock,
            )
        assert exc_info.value.status_code == 403
        assert "лише через Telegram або для адміністратора" in exc_info.value.detail

    async def test_require_telegram_or_staff_allows_valid_init_data(self, test_bot_token):
        valid_raw = build_test_init_data(bot_token=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        allowed = await require_telegram_or_staff(
            init_data_raw=valid_raw,
            admin_token_raw=None,
            settings=settings_mock,
        )
        assert allowed is True

    async def test_require_telegram_or_staff_allows_admin_token(self, test_bot_token):
        admin_token = create_admin_token(telegram_id=999, secret_key=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        allowed = await require_telegram_or_staff(
            init_data_raw=None,
            admin_token_raw=admin_token,
            settings=settings_mock,
        )
        assert allowed is True

    async def test_get_current_user_unregistered_raises_404(
        self, test_bot_token, mock_db_pool, mock_db_conn
    ):
        valid_raw = build_test_init_data(user_id=55555, bot_token=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        mock_db_conn.fetchrow.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                init_data_raw=valid_raw,
                admin_token_raw=None,
                settings=settings_mock,
                pool=mock_db_pool,
            )
        assert exc_info.value.status_code == 404
        assert "Користувача не зареєстровано" in exc_info.value.detail


class TestPublicAndHealthEndpoints:
    """Тестування публічних ендпоінтів."""

    async def test_healthcheck_endpoint(self, async_client):
        response = await async_client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestSecurityVulnerabilityFixes:
    """Тестування виправлення специфічних вразливостей безпеки."""

    async def test_register_verified_phone_cannot_be_changed(
        self, async_client, mock_db_conn, valid_init_data
    ):
        """Захист SEC-03: спроба змінити верифікований номер у POST /register викликає 400."""
        # Існуючий користувач з верифікованим номером
        mock_db_conn.fetchrow.return_value = {
            "is_phone_verified": True,
            "phone": "+380501112233",
        }

        payload = {
            "full_name": "Іван Тестовий",
            "phone": "+380509998877",  # Спроба підмінити номер
            "delivery_address": "м. Вишгород",
        }
        response = await async_client.post(
            "/api/register",
            json=payload,
            headers={"X-Telegram-Init-Data": valid_init_data},
        )
        assert response.status_code == 400
        assert "Верифікований номер телефону не можна змінювати" in response.json()["detail"]

    async def test_admin_auth_session_consumed_on_first_check(
        self, async_client, mock_db_conn
    ):
        """Захист SEC-11: після першого отримання токена сесія маркується як consumed."""
        import uuid
        from datetime import UTC, datetime, timedelta

        session_id = uuid.uuid4()
        mock_db_conn.fetchrow.return_value = {
            "status": "approved",
            "token": "v1.12345.9999999.testsignature",
            "expires_at": datetime.now(UTC) + timedelta(minutes=5),
        }

        response = await async_client.get(f"/api/admin/auth/session/{session_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert response.json()["token"] == "v1.12345.9999999.testsignature"

        # Перевіряємо, що було виконано запит UPDATE admin_auth_sessions SET status = 'consumed'
        mock_db_conn.execute.assert_called_once()
        call_sql = mock_db_conn.execute.call_args[0][0]
        assert "consumed" in call_sql

    async def test_telegram_client_send_message_success(self):
        """Захист SEC-02: асинхронне надсилання через httpx без блокування пулу потоків."""
        from unittest.mock import AsyncMock, patch

        from src.services.telegram_client import send_telegram_message

        mock_resp = AsyncMock()
        mock_resp.status_code = 200

        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            ok = await send_telegram_message("test_token", 123456, "Привіт!")
            assert ok is True
