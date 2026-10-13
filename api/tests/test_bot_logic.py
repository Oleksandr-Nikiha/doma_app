import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure bot modules can be imported
BOT_ROOT = Path(__file__).resolve().parents[2] / "bot"
if str(BOT_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_ROOT))

os.environ.setdefault("BOT_TOKEN", "123456789:TEST_BOT_TOKEN")
os.environ.setdefault("MINI_APP_URL", "https://doma.example.com")
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")

from src.auth.admin_token import create_admin_token, verify_admin_token  # noqa: E402
from src.handlers.orders import (  # noqa: E402
    KYIV_TZ,
    build_all_statuses_keyboard,
    build_order_keyboard,
    build_time_keyboard,
    calculate_new_time,
    get_client_status_message,
    get_minutes_until_scheduled,
    update_admin_message_text,
)


class TestBotScheduledTime:
    """Тестування обчислення часу та таймерів замовлення."""

    def test_get_minutes_until_scheduled_empty(self):
        assert get_minutes_until_scheduled(None) is None
        assert get_minutes_until_scheduled("") is None
        assert get_minutes_until_scheduled("   ") is None
        assert get_minutes_until_scheduled("невідомо") is None

    def test_get_minutes_until_scheduled_iso(self):
        now = datetime.now(KYIV_TZ)
        target = now + timedelta(minutes=45)
        iso_str = target.strftime("%Y-%m-%d %H:%M")
        mins = get_minutes_until_scheduled(iso_str)
        assert mins is not None
        assert 43.0 <= mins <= 47.0

    def test_get_minutes_until_scheduled_iso_with_t_and_seconds(self):
        now = datetime.now(KYIV_TZ)
        target = now + timedelta(minutes=25)
        iso_str = target.strftime("%Y-%m-%dT%H:%M:00")
        mins = get_minutes_until_scheduled(iso_str)
        assert mins is not None
        assert 23.0 <= mins <= 27.0

    def test_get_minutes_until_scheduled_today_prefix(self):
        now = datetime.now(KYIV_TZ)
        target = now + timedelta(minutes=30)
        today_str = f"Сьогодні, {target.strftime('%H:%M')}"
        mins = get_minutes_until_scheduled(today_str)
        assert mins is not None
        assert 28.0 <= mins <= 32.0

    def test_get_minutes_until_scheduled_tomorrow_prefix(self):
        now = datetime.now(KYIV_TZ)
        tomorrow_str = f"Завтра, {now.strftime('%H:%M')}"
        mins = get_minutes_until_scheduled(tomorrow_str)
        assert mins is not None
        # Exactly 24 hours (1435 - 1445 mins)
        assert 1430 <= mins <= 1450

    def test_get_minutes_until_scheduled_hh_mm(self):
        now = datetime.now(KYIV_TZ)
        target = now + timedelta(minutes=20)
        hh_mm_str = target.strftime("%H:%M")
        mins = get_minutes_until_scheduled(hh_mm_str)
        assert mins is not None
        assert 18.0 <= mins <= 22.0


class TestBotCalculateNewTime:
    """Тестування швидкого зсуву часу доставки (+15, +30, asap)."""

    def test_asap_returns_none(self):
        assert calculate_new_time("18:30", "asap") is None
        assert calculate_new_time(None, "asap") is None

    def test_invalid_option_returns_none(self):
        assert calculate_new_time("18:30", "invalid") is None
        assert calculate_new_time("18:30", "+abc") is None

    def test_calculate_new_time_from_none_uses_now(self):
        now = datetime.now(KYIV_TZ)
        expected = (now + timedelta(minutes=30)).strftime("%H:%M")
        result = calculate_new_time(None, "+30")
        assert result == expected

    def test_calculate_new_time_with_full_date_string(self):
        # Previously caused ValueError when split by ':'
        now = datetime.now(KYIV_TZ)
        future_base = now + timedelta(hours=1)
        full_date_str = future_base.strftime("%Y-%m-%d %H:%M")
        expected = (future_base + timedelta(minutes=15)).strftime("%H:%M")
        result = calculate_new_time(full_date_str, "+15")
        assert result == expected

    def test_calculate_new_time_with_today_prefix(self):
        now = datetime.now(KYIV_TZ)
        future_base = now + timedelta(hours=2)
        today_str = f"Сьогодні, {future_base.strftime('%H:%M')}"
        expected = (future_base + timedelta(minutes=45)).strftime("%H:%M")
        result = calculate_new_time(today_str, "+45")
        assert result == expected


class TestBotAdminToken:
    """Тестування безпеки та верифікації HMAC-SHA256 токенів адміна."""

    def test_create_and_verify_valid_token(self):
        secret = "super_secret_test_key_12345"
        tg_id = 987654321
        token = create_admin_token(telegram_id=tg_id, secret_key=secret, days=1)
        assert token.startswith(f"v1.{tg_id}.")
        verified_id = verify_admin_token(token, secret_key=secret)
        assert verified_id == tg_id

    def test_verify_token_wrong_secret(self):
        secret = "super_secret_test_key_12345"
        token = create_admin_token(telegram_id=123, secret_key=secret, days=1)
        assert verify_admin_token(token, secret_key="wrong_secret") is None

    def test_verify_expired_token(self):
        secret = "super_secret_test_key_12345"
        # Token expired 1 day ago
        token = create_admin_token(telegram_id=123, secret_key=secret, days=-1)
        assert verify_admin_token(token, secret_key=secret) is None

    def test_verify_tampered_token(self):
        secret = "super_secret_test_key_12345"
        token = create_admin_token(telegram_id=123, secret_key=secret, days=1)
        parts = token.split(".")
        # Tamper telegram ID to 999
        tampered = f"v1.999.{parts[2]}.{parts[3]}"
        assert verify_admin_token(tampered, secret_key=secret) is None

    def test_verify_malformed_tokens(self):
        secret = "super_secret_test_key_12345"
        assert verify_admin_token("invalid", secret) is None
        assert verify_admin_token("v2.123.456.sig", secret) is None
        assert verify_admin_token("v1.notanint.456.sig", secret) is None


class TestBotStatusNotificationsAndUI:
    """Тестування шаблонів повідомлень та оновлення статусів."""

    def test_client_status_message_confirmed_delivery(self):
        msg = get_client_status_message(
            order_id=42,
            status="confirmed",
            fulfillment_type="delivery",
            addr="вул. Садова, 5",
            total_price=350.0,
            scheduled_time="19:00",
        )
        assert msg is not None
        assert "#42" in msg
        assert "підтверджено" in msg
        assert "вул. Садова, 5" in msg
        assert "19:00" in msg
        assert "350.00" in msg

    def test_client_status_message_confirmed_pickup(self):
        msg = get_client_status_message(
            order_id=43,
            status="confirmed",
            fulfillment_type="pickup",
            addr=None,
            total_price=200.0,
            scheduled_time=None,
        )
        assert msg is not None
        assert "#43" in msg
        assert "підтверджено" in msg
        assert "у закладі" in msg

    def test_client_status_message_in_progress(self):
        msg = get_client_status_message(
            order_id=44,
            status="in_progress",
            fulfillment_type="delivery",
            addr="вул. Миру, 1",
            total_price=100.0,
            scheduled_time=None,
        )
        assert msg is not None
        assert "готується" in msg

    def test_client_status_message_on_the_way(self):
        msg = get_client_status_message(
            order_id=45,
            status="on_the_way",
            fulfillment_type="delivery",
            addr="вул. Миру, 1",
            total_price=100.0,
            scheduled_time=None,
        )
        assert msg is not None
        assert "прямує до вас" in msg

    def test_client_status_message_completed(self):
        msg = get_client_status_message(
            order_id=46,
            status="completed",
            fulfillment_type="pickup",
            addr=None,
            total_price=100.0,
            scheduled_time=None,
        )
        assert msg is not None
        assert "виконано" in msg

    def test_update_admin_message_text(self):
        initial = (
            "<b>📦 Нове замовлення #101</b>\n"
            "👤 Клієнт: Олена\n"
            "📞 Телефон: +380991112233\n"
            "💰 Сума: 450.00 ₴"
        )
        updated_time = update_admin_message_text(initial, time_label="19:30 (+15 хв)")
        assert "⏰ <b>Час:</b> 19:30 (+15 хв)" in updated_time

        updated_status = update_admin_message_text(
            updated_time, status_label="👨‍🍳 Готується (співробітник @manager)"
        )
        assert "📌 <b>Поточний статус:</b> 👨‍🍳 Готується (співробітник @manager)" in updated_status

        # Replace status again - must not duplicate status block
        updated_again = update_admin_message_text(
            updated_status, status_label="🏁 Виконано (співробітник @manager)"
        )
        assert "📌 <b>Поточний статус:</b> 🏁 Виконано (співробітник @manager)" in updated_again
        assert updated_again.count("📌 <b>Поточний статус:</b>") == 1

    def test_keyboards_builder(self):
        kb_pending = build_order_keyboard(1, "pending_moderation", "delivery")
        assert kb_pending is not None
        assert len(kb_pending.inline_keyboard) > 0

        kb_confirmed = build_order_keyboard(1, "confirmed", "delivery")
        assert kb_confirmed is not None

        kb_cooking_pickup = build_order_keyboard(1, "in_progress", "pickup")
        assert kb_cooking_pickup is not None

        kb_cooking_delivery = build_order_keyboard(1, "in_progress", "delivery")
        assert kb_cooking_delivery is not None

        kb_time = build_time_keyboard(1)
        assert kb_time is not None
        assert len(kb_time.inline_keyboard) == 3

        kb_all_statuses = build_all_statuses_keyboard(1, "in_progress", "delivery")
        assert kb_all_statuses is not None
