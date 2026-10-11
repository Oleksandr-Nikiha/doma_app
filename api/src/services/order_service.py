import logging
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import asyncpg
from fastapi import HTTPException, status

from src.schemas.order import (
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
)

logger = logging.getLogger(__name__)

KYIV_TZ = ZoneInfo("Europe/Kyiv")


class OrderService:
    """Сервісний шар доменної логіки замовлень."""

    @staticmethod
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
        now_kyiv = datetime.now(KYIV_TZ)
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

    @staticmethod
    async def fetch_order_by_id(
        conn: asyncpg.Connection, order_id: int, telegram_id: int | None = None
    ) -> OrderOut | None:
        """Вибірка деталей замовлення разом із групами, позиціями та модифікаторами."""
        if telegram_id is not None:
            order_row = await conn.fetchrow(
                """
                SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                       contact_name, contact_phone, payment_method, scheduled_time,
                       comment, total_price, created_at, COALESCE(source, 'telegram') AS source
                FROM orders
                WHERE id = $1 AND telegram_id = $2
                """,
                order_id,
                telegram_id,
            )
        else:
            order_row = await conn.fetchrow(
                """
                SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                       contact_name, contact_phone, payment_method, scheduled_time,
                       comment, total_price, created_at, COALESCE(source, 'telegram') AS source
                FROM orders
                WHERE id = $1
                """,
                order_id,
            )
        if not order_row:
            return None

        groups_rows = await conn.fetch(
            """
            SELECT og.id, og.location_id, loc.name AS location_name, og.status, og.subtotal
            FROM order_groups og
            JOIN locations loc ON loc.id = og.location_id
            WHERE og.order_id = $1
            ORDER BY og.id
            """,
            order_id,
        )

        items_rows = await conn.fetch(
            """
            SELECT id, order_group_id, variant_id, product_name, variant_label,
                   unit_price, qty, subtotal
            FROM order_items
            WHERE order_group_id = ANY($1::int[])
            ORDER BY id
            """,
            [g["id"] for g in groups_rows],
        )

        options_rows = await conn.fetch(
            """
            SELECT id, order_item_id, option_group_name, option_name, price_delta, qty
            FROM order_item_options
            WHERE order_item_id = ANY($1::int[])
            ORDER BY id
            """,
            [i["id"] for i in items_rows],
        )

        opts_by_item: dict[int, list[OrderItemOptionOut]] = {}
        for r in options_rows:
            opts_by_item.setdefault(r["order_item_id"], []).append(
                OrderItemOptionOut(
                    id=r["id"],
                    option_group_name=r["option_group_name"],
                    option_name=r["option_name"],
                    price_delta=float(r["price_delta"]),
                    qty=r["qty"],
                )
            )

        items_by_group: dict[int, list[OrderItemOut]] = {}
        for r in items_rows:
            items_by_group.setdefault(r["order_group_id"], []).append(
                OrderItemOut(
                    id=r["id"],
                    variant_id=r["variant_id"],
                    product_name=r["product_name"],
                    variant_label=r["variant_label"],
                    unit_price=float(r["unit_price"]),
                    qty=r["qty"],
                    subtotal=float(r["subtotal"]),
                    options=opts_by_item.get(r["id"], []),
                )
            )

        return OrderOut(
            id=order_row["id"],
            telegram_id=order_row["telegram_id"],
            status=order_row["status"],
            fulfillment_type=order_row["fulfillment_type"],
            delivery_address=order_row["delivery_address"],
            contact_name=order_row["contact_name"],
            contact_phone=order_row["contact_phone"],
            payment_method=order_row["payment_method"],
            scheduled_time=order_row["scheduled_time"],
            comment=order_row["comment"],
            total_price=float(order_row["total_price"]),
            created_at=order_row["created_at"],
            source=order_row.get("source") or "telegram",
            groups=[
                OrderGroupOut(
                    id=g["id"],
                    location_id=g["location_id"],
                    location_name=g["location_name"],
                    status=g["status"],
                    subtotal=float(g["subtotal"]),
                    items=items_by_group.get(g["id"], []),
                )
                for g in groups_rows
            ],
        )
