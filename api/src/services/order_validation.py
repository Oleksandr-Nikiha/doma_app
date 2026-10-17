import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

KYIV_TZ = ZoneInfo("Europe/Kyiv")


def _get_datetime():
    try:
        import src.services.order_service as _os

        return getattr(_os, "datetime", datetime)
    except Exception:
        return datetime


def validate_scheduled_time(
    scheduled_str: str,
    delivery_start_time: str,
    delivery_end_time: str,
    target_location_name: str,
    fulfillment_type: str,
) -> None:
    """
    Валідує обраний час/дату замовлення:
    - Дата не може бути в минулому
    - Час не може бути в минулому
    - Час не може бути меншим ніж поточний час + 30 хв
    - Час повинен вкладатися в робочі години закладу
    - Працює як для доставки, так і для самовивозу
    """
    dt_cls = _get_datetime()
    now_kyiv = dt_cls.now(KYIV_TZ)
    today_kyiv = now_kyiv.date()
    min_allowed_dt = now_kyiv + timedelta(minutes=30)

    scheduled_dt: datetime | None = None
    clean = scheduled_str.strip()

    # 1. YYYY-MM-DD HH:MM або YYYY-MM-DDTHH:MM
    iso_match = re.match(r"^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})$", clean)
    if iso_match:
        try:
            d_obj = date.fromisoformat(iso_match.group(1))
            h, m = map(int, iso_match.group(2).split(":"))
            scheduled_dt = datetime(d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ)
        except Exception:
            pass

    # 2. 'Завтра, HH:MM' або 'Завтра HH:MM'
    if not scheduled_dt:
        tomorrow_match = re.match(r"^Завтра[, ]+(\d{1,2}:\d{2})$", clean, re.IGNORECASE)
        if tomorrow_match:
            try:
                t_str = tomorrow_match.group(1)
                h, m = map(int, t_str.split(":"))
                d_obj = today_kyiv + timedelta(days=1)
                scheduled_dt = datetime(
                    d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ
                )
            except Exception:
                pass

    # 3. 'Сьогодні, HH:MM' або 'Сьогодні HH:MM'
    if not scheduled_dt:
        today_match = re.match(r"^Сьогодні[, ]+(\d{1,2}:\d{2})$", clean, re.IGNORECASE)
        if today_match:
            try:
                t_str = today_match.group(1)
                h, m = map(int, t_str.split(":"))
                d_obj = today_kyiv
                scheduled_dt = datetime(
                    d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ
                )
            except Exception:
                pass

    # 4. 'HH:MM' (вважається замовленням на сьогодні)
    if not scheduled_dt:
        time_match = re.match(r"^(\d{1,2}):(\d{2})$", clean)
        if time_match:
            try:
                h, m = int(time_match.group(1)), int(time_match.group(2))
                scheduled_dt = datetime(
                    today_kyiv.year, today_kyiv.month, today_kyiv.day, h, m, tzinfo=KYIV_TZ
                )
            except Exception:
                pass

    if not scheduled_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоректний формат бажаного часу замовлення.",
        )

    # 1) Дата не може бути в минулому
    if scheduled_dt.date() < today_kyiv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата замовлення не може бути в минулому.",
        )

    # 2) Час не може бути в минулому
    if scheduled_dt < now_kyiv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Час замовлення не може бути меншим ніж поточний.",
        )

    # 3) Час не може бути меншим ніж "зараз + 30 хв"
    if scheduled_dt < min_allowed_dt:
        min_time_str = min_allowed_dt.strftime("%H:%M")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Час замовлення має бути не меншим ніж поточний час + 30 хв "
                f"(найраніший доступний час: {min_time_str})."
            ),
        )

    # 4) Перевірка робочих годин
    val_time_str = scheduled_dt.strftime("%H:%M")
    if not (delivery_start_time <= val_time_str <= delivery_end_time):
        type_label = "доставки" if fulfillment_type == "delivery" else "самовивозу"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Час {type_label} для «{target_location_name}» можливий лише з "
                f"{delivery_start_time} до {delivery_end_time}."
            ),
        )
