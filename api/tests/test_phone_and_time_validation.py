from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.routers.orders import KYIV_TZ, _validate_scheduled_time
from src.schemas.order import OrderCreateIn
from src.schemas.user import RegisterIn, normalize_phone


class TestPhoneNormalization:
    """Тестування валідації та нормалізації номерів телефонів (SEC-3, E.164)."""

    @pytest.mark.parametrize(
        ("input_phone", "expected"),
        [
            ("0931234567", "+380931234567"),
            ("+380931234567", "+380931234567"),
            ("380931234567", "+380931234567"),
            ("931234567", "+380931234567"),
            ("+38 (093) 123-45-67", "+380931234567"),
            ("050-123-45-67", "+380501234567"),
            ("  067 999 88 77  ", "+380679998877"),
        ],
    )
    def test_normalize_phone_valid_formats(self, input_phone: str, expected: str):
        assert normalize_phone(input_phone) == expected

    @pytest.mark.parametrize(
        "invalid_phone",
        [
            "",
            "   ",
            "12345",
            "09312345",  # 8 цифр
            "38093123456789",  # забагато цифр
            "abcdefghij",
            "+12345678901",
        ],
    )
    def test_normalize_phone_invalid_formats(self, invalid_phone: str):
        error_pattern = "Некоректний номер телефону|Номер телефону обов'язковий"
        with pytest.raises(ValueError, match=error_pattern):
            normalize_phone(invalid_phone)

    def test_register_schema_validates_phone(self):
        """Pydantic-схема RegisterIn автоматично нормалізує телефон."""
        reg = RegisterIn(
            full_name="Олександр",
            phone="093 111 22 33",
        )
        assert reg.phone == "+380931112233"

    def test_register_schema_rejects_invalid_phone(self):
        with pytest.raises(ValidationError):
            RegisterIn(
                full_name="Олександр",
                phone="невірний_номер",
            )


class TestScheduledTimeValidation:
    """Тестування валідації часу доставки та самовивозу."""

    def test_invalid_format_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _validate_scheduled_time(
                scheduled_str="невідомий формат",
                delivery_start_time="10:30",
                delivery_end_time="21:30",
                target_location_name="Doma Pizza",
                fulfillment_type="delivery",
            )
        assert exc_info.value.status_code == 400
        assert "Некоректний формат" in exc_info.value.detail

    def test_past_date_raises_400(self):
        past_date = (datetime.now(KYIV_TZ) - timedelta(days=2)).strftime("%Y-%m-%d 14:00")
        with pytest.raises(HTTPException) as exc_info:
            _validate_scheduled_time(
                scheduled_str=past_date,
                delivery_start_time="10:30",
                delivery_end_time="21:30",
                target_location_name="Doma Pizza",
                fulfillment_type="delivery",
            )
        assert exc_info.value.status_code == 400
        assert "в минулому" in exc_info.value.detail

    def test_time_less_than_30_minutes_raises_400(self, monkeypatch):
        # 10 хвилин від фіксованого денного часу (щоб уникнути переходу через північ)
        fixed_now = datetime(2026, 10, 11, 14, 0, tzinfo=KYIV_TZ)

        class MockDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return fixed_now

        monkeypatch.setattr("src.services.order_service.datetime", MockDateTime)
        too_soon = fixed_now + timedelta(minutes=10)
        time_str = f"Сьогодні, {too_soon.strftime('%H:%M')}"
        with pytest.raises(HTTPException) as exc_info:
            _validate_scheduled_time(
                scheduled_str=time_str,
                delivery_start_time="00:00",
                delivery_end_time="23:59",
                target_location_name="Doma Pizza",
                fulfillment_type="delivery",
            )
        assert exc_info.value.status_code == 400
        assert "не меншим ніж поточний час + 30 хв" in exc_info.value.detail

    def test_time_outside_working_hours_raises_400(self):
        # Час на завтра о 08:00 (до відкриття о 10:30)
        with pytest.raises(HTTPException) as exc_info:
            _validate_scheduled_time(
                scheduled_str="Завтра, 08:00",
                delivery_start_time="10:30",
                delivery_end_time="21:30",
                target_location_name="Doma Pizza",
                fulfillment_type="delivery",
            )
        assert exc_info.value.status_code == 400
        assert "можливий лише з 10:30 до 21:30" in exc_info.value.detail

    def test_valid_scheduled_time_tomorrow_passes(self):
        # Завтра о 14:00 — робочий час
        _validate_scheduled_time(
            scheduled_str="Завтра, 14:00",
            delivery_start_time="10:30",
            delivery_end_time="21:30",
            target_location_name="Doma Pizza",
            fulfillment_type="delivery",
        )

    def test_valid_iso_format_tomorrow_passes(self):
        tomorrow_iso = (datetime.now(KYIV_TZ) + timedelta(days=1)).strftime("%Y-%m-%d 15:00")
        _validate_scheduled_time(
            scheduled_str=tomorrow_iso,
            delivery_start_time="10:30",
            delivery_end_time="21:30",
            target_location_name="Doma Croissants",
            fulfillment_type="pickup",
        )


class TestOrderCreateSchemaValidation:
    """Тестування валідації вхідних даних створення замовлення."""

    def test_delivery_without_address_fails(self):
        with pytest.raises(ValidationError, match="Адреса доставки обов'язкова"):
            OrderCreateIn(
                fulfillment_type="delivery",
                delivery_address=None,
                contact_name="Іван",
                contact_phone="0931112233",
                payment_method="cash",
            )

    def test_pickup_without_location_id_fails(self):
        with pytest.raises(ValidationError, match="Локація обов'язкова для самовивозу"):
            OrderCreateIn(
                fulfillment_type="pickup",
                location_id=None,
                contact_name="Іван",
                contact_phone="0931112233",
                payment_method="cash",
            )

    def test_qr_payment_only_for_delivery(self):
        with pytest.raises(ValidationError, match="Оплата по QR-коду доступна лише при доставці"):
            OrderCreateIn(
                fulfillment_type="pickup",
                location_id=1,
                contact_name="Іван",
                contact_phone="0931112233",
                payment_method="qr",
            )

    def test_valid_delivery_order_schema(self):
        order = OrderCreateIn(
            fulfillment_type="delivery",
            delivery_address="вул. Набережна, 5",
            contact_name="Іван",
            contact_phone="0931112233",
            payment_method="cash",
        )
        assert order.contact_phone == "+380931112233"
