import logging
import re
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import asyncpg
from fastapi import HTTPException, status

from src.db.cart_repo import get_or_create_cart_id
from src.routers.cart import _fetch_cart, build_options_key, options_cost
from src.schemas.order import (
    OrderCreateIn,
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
    RepeatOrderOut,
    WebOrderCreateIn,
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
    async def fetch_orders_batch(
        conn: asyncpg.Connection, order_rows: list[asyncpg.Record]
    ) -> list[OrderOut]:
        """
        Пакетна вибірка деталей для списку замовлень (усуває проблему N+1 запитів).
        Виконує рівно 3 запити (groups, items, options) незалежно від кількості замовлень.
        """
        if not order_rows:
            return []

        order_ids = [r["id"] for r in order_rows]

        groups_rows = await conn.fetch(
            """
            SELECT og.id, og.order_id, og.location_id,
                   loc.name AS location_name, og.status, og.subtotal
            FROM order_groups og
            JOIN locations loc ON loc.id = og.location_id
            WHERE og.order_id = ANY($1::int[])
            ORDER BY og.id
            """,
            order_ids,
        )


        group_ids = [g["id"] for g in groups_rows]
        items_rows = []
        if group_ids:
            items_rows = await conn.fetch(
                """
                SELECT id, order_group_id, variant_id, product_name, variant_label,
                       unit_price, qty, subtotal
                FROM order_items
                WHERE order_group_id = ANY($1::int[])
                ORDER BY id
                """,
                group_ids,
            )

        item_ids = [i["id"] for i in items_rows]
        options_rows = []
        if item_ids:
            options_rows = await conn.fetch(
                """
                SELECT id, order_item_id, option_group_name, option_name, price_delta, qty
                FROM order_item_options
                WHERE order_item_id = ANY($1::int[])
                ORDER BY id
                """,
                item_ids,
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

        groups_by_order: dict[int, list[OrderGroupOut]] = {}
        for g in groups_rows:
            target_order_id = (
                g["order_id"]
                if "order_id" in g
                else (order_ids[0] if len(order_ids) == 1 else None)
            )
            if target_order_id is not None:
                groups_by_order.setdefault(target_order_id, []).append(
                    OrderGroupOut(
                        id=g["id"],
                        location_id=g["location_id"],
                        location_name=g["location_name"],
                        status=g["status"],
                        subtotal=float(g["subtotal"]),
                        items=items_by_group.get(g["id"], []),
                    )
                )


        results = []
        for o in order_rows:
            results.append(
                OrderOut(
                    id=o["id"],
                    telegram_id=o["telegram_id"],
                    status=o["status"],
                    fulfillment_type=o["fulfillment_type"],
                    delivery_address=o["delivery_address"],
                    contact_name=o["contact_name"],
                    contact_phone=o["contact_phone"],
                    payment_method=o["payment_method"],
                    scheduled_time=o["scheduled_time"],
                    comment=o["comment"],
                    total_price=float(o["total_price"]),
                    created_at=o["created_at"],
                    source=o.get("source") or "telegram",
                    groups=groups_by_order.get(o["id"], []),
                )
            )
        return results

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

        orders = await OrderService.fetch_orders_batch(conn, [order_row])
        return orders[0] if orders else None

    @staticmethod
    async def create_web_order(
        conn: asyncpg.Connection,
        payload: WebOrderCreateIn,
    ) -> tuple[OrderOut, int | None, dict[str, Any]]:
        """
        Створює замовлення з веб-сайту закладу:
        - Валідує заклад, робочі години, доставку та запланований час
        - Перевіряє доступність страв та модифікаторів
        - Розраховує ціну з урахуванням безкоштовних модифікаторів (free_count)
        - Автоматично створює або оновлює користувача за номером телефону
        - Зберігає замовлення, групу, позиції та модифікатори
        Повертає (створене замовлення, telegram_id клієнта, дані для сповіщення).
        """
        # 1. Перевірка закладу та робочих годин
        loc_row = await conn.fetchrow(
            """
            SELECT id, name, is_delivery_enabled,
                   to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
                   to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
            FROM locations
            WHERE id = $1
            """,
            payload.location_id,
        )
        if not loc_row:
            raise HTTPException(status_code=404, detail="Заклад не знайдено")

        target_location_name = loc_row["name"]
        is_delivery_enabled = loc_row["is_delivery_enabled"]
        delivery_start_time = loc_row["delivery_start_time"] or "10:30"
        delivery_end_time = loc_row["delivery_end_time"] or "21:30"

        if payload.fulfillment_type == "delivery" and not is_delivery_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Доставка з закладу «{target_location_name}» тимчасово призупинена. "
                    "Будь ласка, оберіть самовивіз."
                ),
            )

        clean_scheduled_time = None
        if payload.scheduled_time and payload.scheduled_time.strip():
            clean_scheduled_time = payload.scheduled_time.strip()
            OrderService.validate_scheduled_time(
                clean_scheduled_time,
                delivery_start_time,
                delivery_end_time,
                target_location_name,
                payload.fulfillment_type,
            )

        # 2. Валідація позицій замовлення
        variant_ids = [it.variant_id for it in payload.items]
        variants_sql = """
            SELECT pv.id AS variant_id, pv.price, pv.label AS variant_label,
                   pv.is_available AS pv_avail,
                   p.id AS product_id, p.name AS product_name, p.is_available AS p_avail,
                   c.location_id
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE pv.id = ANY($1::int[])
        """
        v_rows = await conn.fetch(variants_sql, variant_ids)
        v_map = {r["variant_id"]: r for r in v_rows}

        for it in payload.items:
            v_info = v_map.get(it.variant_id)
            if not v_info:
                raise HTTPException(
                    status_code=404,
                    detail=f"Страву (варіант #{it.variant_id}) не знайдено",
                )
            if not v_info["p_avail"] or not v_info["pv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Страва «{v_info['product_name']}» наразі недоступна",
                )
            if v_info["location_id"] != payload.location_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Страва «{v_info['product_name']}» належить іншому закладу",
                )

        # 3. Валідація модифікаторів
        all_opt_ids = [opt for it in payload.items for opt in it.option_variant_ids]
        opt_map = {}
        if all_opt_ids:
            options_sql = """
                SELECT pog.product_id, pog.group_id, g.name AS group_name,
                       pog.min_select, pog.max_select, pog.free_count,
                       ogi.variant_id, ogi.price_delta, op.name AS option_name,
                       ogi.is_available AS ogi_avail, op.is_available AS op_avail,
                       opv.is_available AS opv_avail
                FROM product_option_groups pog
                JOIN option_groups g ON g.id = pog.group_id
                JOIN option_group_items ogi ON ogi.group_id = g.id
                JOIN product_variants opv ON opv.id = ogi.variant_id
                JOIN products op ON op.id = opv.product_id
                WHERE ogi.variant_id = ANY($1::int[])
            """
            opt_rows = await conn.fetch(options_sql, all_opt_ids)
            for r in opt_rows:
                opt_map[(r["product_id"], r["variant_id"])] = r

        # 4. Розрахунок вартості страв та опцій
        total_order_price = 0.0
        calculated_items: list[dict[str, Any]] = []

        for it in payload.items:
            v_info = v_map[it.variant_id]
            prod_id = v_info["product_id"]
            unit_price = float(v_info["price"])

            item_options: list[dict[str, Any]] = []
            extra_cost = 0.0

            opt_by_group: dict[int, list[asyncpg.Record]] = {}
            for opt_vid in it.option_variant_ids:
                opt_row = opt_map.get((prod_id, opt_vid))
                if not opt_row:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Невалідна опція #{opt_vid} для страви «{v_info['product_name']}»",
                    )
                if not opt_row["ogi_avail"] or not opt_row["op_avail"] or not opt_row["opv_avail"]:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Опція «{opt_row['option_name']}» наразі недоступна",
                    )
                opt_by_group.setdefault(opt_row["group_id"], []).append(opt_row)

            for _g_id, g_opts in opt_by_group.items():
                units = [float(o["price_delta"]) for o in g_opts]
                eff_free = g_opts[0]["free_count"] * it.qty
                extra_cost += options_cost(units, eff_free)
                for o in g_opts:
                    item_options.append(
                        {
                            "option_group_name": o["group_name"],
                            "name": o["option_name"],
                            "price_delta": float(o["price_delta"]),
                            "qty": 1,
                        }
                    )

            item_subtotal = round(unit_price * it.qty + extra_cost, 2)
            total_order_price += item_subtotal

            calculated_items.append(
                {
                    "variant_id": it.variant_id,
                    "product_name": v_info["product_name"],
                    "variant_label": v_info["variant_label"],
                    "unit_price": unit_price,
                    "qty": it.qty,
                    "subtotal": item_subtotal,
                    "options": item_options,
                }
            )

        total_order_price = round(total_order_price, 2)

        # 5. Транзакційний запис у БД
        async with conn.transaction():
            clean_phone = payload.contact_phone.strip()
            clean_name = payload.contact_name.strip()

            user_row = await conn.fetchrow(
                """
                SELECT id, telegram_id, phone, full_name, is_phone_verified
                FROM users
                WHERE phone = $1 OR (telegram_id IS NOT NULL AND telegram_id = $2)
                """,
                clean_phone,
                payload.telegram_id,
            )

            customer_tg_id = payload.telegram_id
            if user_row:
                user_dict = dict(user_row)
                customer_tg_id = user_dict.get("telegram_id") or payload.telegram_id
                await conn.execute(
                    """
                    UPDATE users
                    SET full_name = CASE
                            WHEN full_name = '' OR full_name LIKE 'Гість%' THEN $1
                            ELSE full_name
                        END,
                        delivery_address = COALESCE(delivery_address, $2),
                        telegram_id = COALESCE(telegram_id, $3),
                        is_phone_verified = CASE
                            WHEN $3 IS NOT NULL THEN true
                            ELSE is_phone_verified
                        END,
                        updated_at = now()
                    WHERE id = $4
                    """,
                    clean_name,
                    payload.delivery_address,
                    payload.telegram_id,
                    user_dict.get("id"),
                )
            else:
                first_name = clean_name.split(" ", 1)[0] if clean_name else ""
                last_name = clean_name.split(" ", 1)[1] if " " in clean_name else None
                is_verified = bool(payload.telegram_id)
                await conn.execute(
                    """
                    INSERT INTO users (
                        telegram_id, full_name, first_name, last_name, phone,
                        delivery_address, is_phone_verified, password_hash
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    payload.telegram_id,
                    clean_name,
                    first_name,
                    last_name,
                    clean_phone,
                    payload.delivery_address,
                    is_verified,
                    None,
                )

            order_row = await conn.fetchrow(
                """
                INSERT INTO orders (
                    telegram_id, status, fulfillment_type, delivery_address,
                    contact_name, contact_phone, payment_method, scheduled_time,
                    comment, total_price, source
                )
                VALUES ($1, 'pending_moderation', $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id, created_at
                """,
                customer_tg_id,
                payload.fulfillment_type,
                payload.delivery_address,
                clean_name,
                clean_phone,
                payload.payment_method,
                clean_scheduled_time,
                payload.comment.strip() if payload.comment else None,
                total_order_price,
                payload.source,
            )
            order_id = order_row["id"]
            created_at = order_row["created_at"]

            group_row = await conn.fetchrow(
                """
                INSERT INTO order_groups (order_id, location_id, status, subtotal)
                VALUES ($1, $2, 'pending', $3)
                RETURNING id
                """,
                order_id,
                payload.location_id,
                total_order_price,
            )
            order_group_id = group_row["id"]

            saved_items: list[OrderItemOut] = []
            for item in calculated_items:
                item_row = await conn.fetchrow(
                    """
                    INSERT INTO order_items (
                        order_group_id, variant_id, product_name, variant_label,
                        unit_price, qty, subtotal
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                    """,
                    order_group_id,
                    item["variant_id"],
                    item["product_name"],
                    item["variant_label"],
                    item["unit_price"],
                    item["qty"],
                    item["subtotal"],
                )
                saved_item_id = item_row["id"]

                saved_opts: list[OrderItemOptionOut] = []
                for opt in item["options"]:
                    opt_row = await conn.fetchrow(
                        """
                        INSERT INTO order_item_options (
                            order_item_id, option_group_name, option_name, price_delta, qty
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING id
                        """,
                        saved_item_id,
                        opt["option_group_name"],
                        opt["name"],
                        opt["price_delta"],
                        opt["qty"],
                    )
                    saved_opts.append(
                        OrderItemOptionOut(
                            id=opt_row["id"],
                            option_group_name=opt["option_group_name"],
                            option_name=opt["name"],
                            price_delta=opt["price_delta"],
                            qty=opt["qty"],
                        )
                    )

                saved_items.append(
                    OrderItemOut(
                        id=saved_item_id,
                        variant_id=item["variant_id"],
                        product_name=item["product_name"],
                        variant_label=item["variant_label"],
                        unit_price=item["unit_price"],
                        qty=item["qty"],
                        subtotal=item["subtotal"],
                        options=saved_opts,
                    )
                )

        order_notification_data = {
            "location_name": target_location_name,
            "contact_name": payload.contact_name,
            "contact_phone": payload.contact_phone,
            "fulfillment_type": payload.fulfillment_type,
            "delivery_address": payload.delivery_address,
            "payment_method": payload.payment_method,
            "scheduled_time": clean_scheduled_time,
            "comment": payload.comment,
            "total_price": total_order_price,
            "items": calculated_items,
            "source": payload.source,
            "telegram_id": customer_tg_id,
        }

        order_out = OrderOut(
            id=order_id,
            telegram_id=customer_tg_id,
            status="pending_moderation",
            fulfillment_type=payload.fulfillment_type,
            delivery_address=payload.delivery_address,
            contact_name=payload.contact_name,
            contact_phone=payload.contact_phone,
            payment_method=payload.payment_method,
            scheduled_time=clean_scheduled_time,
            comment=payload.comment,
            total_price=total_order_price,
            created_at=created_at,
            source=payload.source,
            groups=[
                OrderGroupOut(
                    id=order_group_id,
                    location_id=payload.location_id,
                    location_name=target_location_name,
                    status="pending",
                    subtotal=total_order_price,
                    items=saved_items,
                )
            ],
        )
        return order_out, customer_tg_id, order_notification_data

    @staticmethod
    async def create_cart_order(
        conn: asyncpg.Connection,
        user: dict[str, Any] | asyncpg.Record,
        payload: OrderCreateIn,
    ) -> tuple[OrderOut, dict[str, Any], bool]:
        """
        Створює нове замовлення з кошика авторизованого користувача:
        - Отримує позиції кошика та блокує їх (FOR UPDATE)
        - Перевіряє робочі години закладу, мультилокаційність, доступність доставки та QR-оплати
        - Перевіряє доступність страв та модифікаторів
        - Розраховує ціни з урахуванням безкоштовних модифікаторів
        - Запобігає дублюванню замовлень протягом 20 секунд (SEC-2)
        - Зберігає замовлення та очищає кошик
        Повертає (замовлення, дані сповіщення, is_duplicate).
        """
        telegram_id = user["telegram_id"]

        # 1. Отримуємо позиції кошика користувача разом із даними про заклад та наявність
        cart_items_sql = """
            SELECT ci.id, ci.variant_id, ci.qty,
                   p.id AS product_id, p.name AS product_name, p.is_available AS p_avail,
                   pv.label AS variant_label, pv.price, pv.is_available AS pv_avail,
                   loc.id AS location_id, loc.name AS location_name,
                   loc.is_delivery_enabled,
                   to_char(loc.delivery_start_time, 'HH24:MI') AS delivery_start_time,
                   to_char(loc.delivery_end_time, 'HH24:MI') AS delivery_end_time
            FROM cart_items ci
            JOIN product_variants pv ON pv.id = ci.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN categories cat ON cat.id = p.category_id
            JOIN locations loc ON loc.id = cat.location_id
            JOIN carts c ON c.id = ci.cart_id
            WHERE c.telegram_id = $1
            ORDER BY ci.id
            FOR UPDATE OF ci
        """
        item_rows = await conn.fetch(cart_items_sql, telegram_id)

        if not item_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Кошик порожній",
            )

        # 2. Фільтрація за закладом / перевірка мультилокаційності
        distinct_locations = {row["location_id"]: row["location_name"] for row in item_rows}

        if payload.location_id is not None:
            if payload.location_id not in distinct_locations:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="У кошику немає страв з обраного закладу",
                )
            target_location_id = payload.location_id
            target_location_name = distinct_locations[target_location_id]
            order_item_rows = [r for r in item_rows if r["location_id"] == target_location_id]
        else:
            if len(distinct_locations) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "У кошику є страви з різних закладів. "
                        "Будь ласка, оформіть окреме замовлення для кожного закладу."
                    ),
                )
            target_location_id = list(distinct_locations.keys())[0]
            target_location_name = list(distinct_locations.values())[0]
            order_item_rows = item_rows

        target_loc_row = order_item_rows[0]
        is_delivery_enabled = target_loc_row["is_delivery_enabled"]
        delivery_start_time = target_loc_row["delivery_start_time"] or "10:30"
        delivery_end_time = target_loc_row["delivery_end_time"] or "21:30"

        # Перевірка доступності доставки при навантаженні
        if payload.fulfillment_type == "delivery" and not is_delivery_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Доставка з закладу «{target_location_name}» тимчасово призупинена "
                    "через високе навантаження. Будь ласка, оберіть самовивіз."
                ),
            )

        # Перевірка умов оплати (QR доступний тільки для піцерії при доставці)
        if payload.payment_method == "qr":
            if "pizza" not in target_location_name.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Оплата по QR-коду доступна виключно для піцерії.",
                )
            if payload.fulfillment_type != "delivery":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Оплата по QR-коду доступна лише при замовленні доставки.",
                )

        # Валідація часу доставки або самовивозу (якщо вказано)
        clean_scheduled_time = payload.scheduled_time.strip() if payload.scheduled_time else None
        if clean_scheduled_time:
            OrderService.validate_scheduled_time(
                scheduled_str=clean_scheduled_time,
                delivery_start_time=delivery_start_time,
                delivery_end_time=delivery_end_time,
                target_location_name=target_location_name,
                fulfillment_type=payload.fulfillment_type,
            )

        target_cart_item_ids = [r["id"] for r in order_item_rows]

        # 3. Перевірка доступності товарів
        for row in order_item_rows:
            if not row["p_avail"] or not row["pv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Страва «{row['product_name']}» наразі недоступна для замовлення",
                )

        # 4. Отримуємо опції для вибраних позицій
        options_sql = """
            SELECT cio.cart_item_id, cio.group_id, cio.variant_id, cio.qty,
                   og.name AS group_name, op.name AS option_name,
                   ogi.price_delta, ogi.is_available AS ogi_avail,
                   op.is_available AS op_avail, opv.is_available AS opv_avail,
                   pog.free_count
            FROM cart_item_options cio
            JOIN option_groups og ON og.id = cio.group_id
            JOIN option_group_items ogi
                 ON ogi.group_id = cio.group_id AND ogi.variant_id = cio.variant_id
            JOIN product_variants opv ON opv.id = cio.variant_id
            JOIN products op ON op.id = opv.product_id
            JOIN cart_items ci ON ci.id = cio.cart_item_id
            JOIN product_variants cv ON cv.id = ci.variant_id
            JOIN product_option_groups pog
                 ON pog.product_id = cv.product_id AND pog.group_id = cio.group_id
            WHERE cio.cart_item_id = ANY($1::int[])
            ORDER BY cio.cart_item_id, pog.sort_order, ogi.sort_order
        """
        option_rows = await conn.fetch(options_sql, target_cart_item_ids)

        # Перевірка доступності опцій
        by_item_opts: dict[int, dict[int, list[asyncpg.Record]]] = {}
        for row in option_rows:
            if not row["ogi_avail"] or not row["op_avail"] or not row["opv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Опція «{row['option_name']}» наразі недоступна",
                )
            item_groups = by_item_opts.setdefault(row["cart_item_id"], {})
            item_groups.setdefault(row["group_id"], []).append(row)

        # 5. Підрахунок сум
        total_order_price = 0.0
        calculated_items: list[dict[str, Any]] = []

        for item in order_item_rows:
            groups = by_item_opts.get(item["id"], {})
            item_options: list[dict[str, Any]] = []
            extra_cost = 0.0

            for g_rows in groups.values():
                units: list[float] = []
                for o_row in g_rows:
                    delta = float(o_row["price_delta"])
                    units.extend([delta] * o_row["qty"])
                    item_options.append(
                        {
                            "option_group_name": o_row["group_name"],
                            "name": o_row["option_name"],
                            "price_delta": delta,
                            "qty": o_row["qty"],
                        }
                    )

                eff_free = g_rows[0]["free_count"] * item["qty"]
                extra_cost += options_cost(units, eff_free)

            unit_price = float(item["price"])
            item_subtotal = round(unit_price * item["qty"] + extra_cost, 2)
            total_order_price += item_subtotal

            calculated_items.append(
                {
                    "variant_id": item["variant_id"],
                    "product_name": item["product_name"],
                    "variant_label": item["variant_label"],
                    "unit_price": unit_price,
                    "qty": item["qty"],
                    "subtotal": item_subtotal,
                    "options": item_options,
                }
            )

        total_order_price = round(total_order_price, 2)

        # 5.1 Захист від дублювання замовлень (SEC-2)
        recent_order_id = await conn.fetchval(
            """
            SELECT o.id
            FROM orders o
            JOIN order_groups og ON og.order_id = o.id
            WHERE o.telegram_id = $1
              AND og.location_id = $2
              AND o.status = 'pending_moderation'
              AND o.total_price = $3
              AND o.created_at > now() - interval '20 seconds'
            ORDER BY o.id DESC
            LIMIT 1
            """,
            telegram_id,
            target_location_id,
            total_order_price,
        )
        if recent_order_id:
            logger.info(
                "Повторний запит: знайдено нещодавно створене замовлення #%s", recent_order_id
            )
            existing_order = await OrderService.fetch_order_by_id(
                conn, recent_order_id, telegram_id
            )
            if existing_order:
                return existing_order, {}, True

        # 6. Створення замовлення в БД
        order_insert_sql = """
            INSERT INTO orders (
                telegram_id, status, fulfillment_type, delivery_address,
                contact_name, contact_phone, payment_method, scheduled_time,
                comment, total_price
            )
            VALUES ($1, 'pending_moderation', $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, created_at
        """
        order_row = await conn.fetchrow(
            order_insert_sql,
            telegram_id,
            payload.fulfillment_type,
            payload.delivery_address,
            payload.contact_name.strip(),
            payload.contact_phone.strip(),
            payload.payment_method,
            clean_scheduled_time,
            payload.comment.strip() if payload.comment else None,
            total_order_price,
        )
        order_id = order_row["id"]
        created_at = order_row["created_at"]

        group_insert_sql = """
            INSERT INTO order_groups (order_id, location_id, status, subtotal)
            VALUES ($1, $2, 'pending', $3)
            RETURNING id
        """
        group_row = await conn.fetchrow(
            group_insert_sql,
            order_id,
            target_location_id,
            total_order_price,
        )
        order_group_id = group_row["id"]

        saved_items: list[OrderItemOut] = []
        options_batch: list[tuple] = []
        options_by_item_map: dict[int, list[OrderItemOptionOut]] = {}

        item_insert_sql = """
            INSERT INTO order_items (
                order_group_id, variant_id, product_name, variant_label,
                unit_price, qty, subtotal
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        """

        for calc_item in calculated_items:
            item_db = await conn.fetchrow(
                item_insert_sql,
                order_group_id,
                calc_item["variant_id"],
                calc_item["product_name"],
                calc_item["variant_label"],
                calc_item["unit_price"],
                calc_item["qty"],
                calc_item["subtotal"],
            )
            saved_item_id = item_db["id"]
            options_by_item_map[saved_item_id] = []

            for opt in calc_item["options"]:
                options_batch.append(
                    (
                        saved_item_id,
                        opt["option_group_name"],
                        opt["name"],
                        opt["price_delta"],
                        opt["qty"],
                    )
                )
                options_by_item_map[saved_item_id].append(
                    OrderItemOptionOut(
                        id=0,
                        option_group_name=opt["option_group_name"],
                        option_name=opt["name"],
                        price_delta=opt["price_delta"],
                        qty=opt["qty"],
                    )
                )

            saved_items.append(
                OrderItemOut(
                    id=saved_item_id,
                    variant_id=calc_item["variant_id"],
                    product_name=calc_item["product_name"],
                    variant_label=calc_item["variant_label"],
                    unit_price=calc_item["unit_price"],
                    qty=calc_item["qty"],
                    subtotal=calc_item["subtotal"],
                    options=options_by_item_map[saved_item_id],
                )
            )

        if options_batch:
            opt_insert_sql = """
                INSERT INTO order_item_options (
                    order_item_id, option_group_name, option_name, price_delta, qty
                )
                VALUES ($1, $2, $3, $4, $5)
            """
            await conn.executemany(opt_insert_sql, options_batch)

        await conn.execute(
            "DELETE FROM cart_items WHERE id = ANY($1::int[])",
            target_cart_item_ids,
        )

        order_notification_data = {
            "location_name": target_location_name,
            "contact_name": payload.contact_name,
            "contact_phone": payload.contact_phone,
            "fulfillment_type": payload.fulfillment_type,
            "delivery_address": payload.delivery_address,
            "payment_method": payload.payment_method,
            "scheduled_time": clean_scheduled_time,
            "comment": payload.comment,
            "total_price": total_order_price,
            "items": calculated_items,
            "admin_note": user.get("admin_note"),
            "telegram_id": telegram_id,
            "is_phone_verified": bool(user.get("is_phone_verified")),
        }

        order_out = OrderOut(
            id=order_id,
            telegram_id=telegram_id,
            status="pending_moderation",
            fulfillment_type=payload.fulfillment_type,
            delivery_address=payload.delivery_address,
            contact_name=payload.contact_name,
            contact_phone=payload.contact_phone,
            payment_method=payload.payment_method,
            scheduled_time=clean_scheduled_time,
            comment=payload.comment,
            total_price=total_order_price,
            created_at=created_at,
            groups=[
                OrderGroupOut(
                    id=order_group_id,
                    location_id=target_location_id,
                    location_name=target_location_name,
                    status="pending",
                    subtotal=total_order_price,
                    items=saved_items,
                )
            ],
        )
        return order_out, order_notification_data, False

    @staticmethod
    async def cancel_user_order(
        conn: asyncpg.Connection,
        order_id: int,
        telegram_id: int,
    ) -> tuple[OrderOut, asyncpg.Record]:
        """
        Скасування замовлення клієнтом:
        - Перевіряє права доступу та статус pending_moderation (із блокуванням FOR UPDATE)
        - Переводить статус у cancelled
        Повертає (оновлене замовлення, рядок замовлення для сповіщення).
        """
        async with conn.transaction():
            order_row = await conn.fetchrow(
                """
                SELECT id, telegram_id, status, contact_name, contact_phone, total_price
                FROM orders
                WHERE id = $1 AND telegram_id = $2
                FOR UPDATE
                """,
                order_id,
                telegram_id,
            )
            if not order_row:
                raise HTTPException(status_code=404, detail="Замовлення не знайдено")

            if order_row["status"] != "pending_moderation":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Неможливо скасувати замовлення, оскільки воно вже обробляється "
                        "або завершено. Для скасування зателефонуйте, будь ласка, до закладу."
                    ),
                )

            await conn.execute(
                "UPDATE orders SET status = 'cancelled' WHERE id = $1",
                order_id,
            )

        updated = await OrderService.fetch_order_by_id(conn, order_id, telegram_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        return updated, order_row

    @staticmethod
    async def repeat_user_order(
        conn: asyncpg.Connection,
        pool: asyncpg.Pool,
        order_id: int,
        telegram_id: int,
        replace_cart: bool = True,
    ) -> RepeatOrderOut:
        """
        Повторює раніше оформлене замовлення, додаючи його доступні позиції до кошика
        за актуальними цінами поточного меню.
        """
        async with conn.transaction():
            order_row = await conn.fetchrow(
                """
                SELECT id, telegram_id, total_price
                FROM orders
                WHERE id = $1 AND telegram_id = $2
                """,
                order_id,
                telegram_id,
            )
            if not order_row:
                raise HTTPException(status_code=404, detail="Замовлення не знайдено")

            old_order_total = float(order_row["total_price"])

            group_rows = await conn.fetch(
                "SELECT id FROM order_groups WHERE order_id = $1",
                order_id,
            )
            if not group_rows:
                raise HTTPException(status_code=400, detail="У замовленні немає страв")

            group_ids = [g["id"] for g in group_rows]

            order_items_sql = """
                SELECT oi.id, oi.variant_id, oi.product_name, oi.variant_label, oi.qty,
                       pv.id as current_variant_id, pv.price as current_variant_price,
                       pv.is_available as pv_avail,
                       p.id as current_product_id, p.name as current_product_name,
                       p.is_available as p_avail
                FROM order_items oi
                LEFT JOIN product_variants pv ON pv.id = oi.variant_id
                LEFT JOIN products p ON p.id = pv.product_id
                WHERE oi.order_group_id = ANY($1::int[])
                ORDER BY oi.id
            """
            order_item_rows = await conn.fetch(order_items_sql, group_ids)

            order_item_ids = [r["id"] for r in order_item_rows]
            options_sql = """
                SELECT oio.order_item_id, oio.option_group_name, oio.option_name, oio.qty
                FROM order_item_options oio
                WHERE oio.order_item_id = ANY($1::int[])
                ORDER BY oio.id
            """
            order_opt_rows = (
                await conn.fetch(options_sql, order_item_ids) if order_item_ids else []
            )

            opts_by_order_item: dict[int, list[asyncpg.Record]] = {}
            for opt in order_opt_rows:
                opts_by_order_item.setdefault(opt["order_item_id"], []).append(opt)

            cart_id = await get_or_create_cart_id(conn, telegram_id)
            if replace_cart:
                await conn.execute("DELETE FROM cart_items WHERE cart_id = $1", cart_id)

            unavailable_items: list[str] = []
            added_count = 0

            for item in order_item_rows:
                p_name = item["product_name"]
                v_id = item["current_variant_id"]

                if not v_id or not item["pv_avail"] or not item["p_avail"]:
                    unavailable_items.append(f"{p_name} ({item['variant_label']})")
                    continue

                saved_opts = opts_by_order_item.get(item["id"], [])
                resolved_options: list[dict[str, Any]] = []
                options_unavailable = False

                if saved_opts:
                    for s_opt in saved_opts:
                        opt_match = await conn.fetchrow(
                            """
                            SELECT ogi.group_id, ogi.variant_id,
                                   ogi.is_available as ogi_avail,
                                   op.is_available as op_avail,
                                   opv.is_available as opv_avail
                            FROM product_variants pv
                            JOIN products p ON p.id = pv.product_id
                            JOIN product_option_groups pog ON pog.product_id = p.id
                            JOIN option_groups og ON og.id = pog.group_id
                            JOIN option_group_items ogi ON ogi.group_id = og.id
                            JOIN product_variants opv ON opv.id = ogi.variant_id
                            JOIN products op ON op.id = opv.product_id
                            WHERE pv.id = $1 AND og.name = $2 AND op.name = $3
                            LIMIT 1
                            """,
                            v_id,
                            s_opt["option_group_name"],
                            s_opt["option_name"],
                        )
                        if (
                            not opt_match
                            or not opt_match["ogi_avail"]
                            or not opt_match["op_avail"]
                            or not opt_match["opv_avail"]
                        ):
                            options_unavailable = True
                            break
                        resolved_options.append(
                            {
                                "group_id": opt_match["group_id"],
                                "variant_id": opt_match["variant_id"],
                                "qty": s_opt["qty"],
                            }
                        )

                if options_unavailable:
                    unavailable_items.append(f"{p_name} (опції більше недоступні)")
                    continue

                options_key = build_options_key(resolved_options, item_qty=item["qty"])

                cart_item_id = await conn.fetchval(
                    """
                    INSERT INTO cart_items (cart_id, variant_id, qty, options_key)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (cart_id, variant_id, options_key)
                    DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty
                    RETURNING id
                    """,
                    cart_id,
                    v_id,
                    item["qty"],
                    options_key,
                )

                for opt in resolved_options:
                    await conn.execute(
                        """
                        INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (cart_item_id, group_id, variant_id)
                        DO UPDATE SET qty = EXCLUDED.qty
                        """,
                        cart_item_id,
                        opt["group_id"],
                        opt["variant_id"],
                        opt["qty"],
                    )

                added_count += 1

            if added_count == 0:
                raise HTTPException(
                    status_code=400,
                    detail="На жаль, жодна зі страв цього замовлення зараз недоступна в меню.",
                )

        current_cart = await _fetch_cart(pool, telegram_id)
        price_diff = abs(current_cart.total - old_order_total) > 0.01

        return RepeatOrderOut(
            added_count=added_count,
            unavailable_items=unavailable_items,
            price_changed=price_diff,
            old_total=old_order_total,
            new_total=current_cart.total,
        )


