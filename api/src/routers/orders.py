import asyncio
import html
import json
import logging
import urllib.error
import urllib.request
from typing import Any

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from src.auth.deps import get_current_user
from src.config import get_settings
from src.db.connection import get_pool
from src.routers.cart import options_cost
from src.schemas.order import (
    OrderCreateIn,
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _send_telegram_notification_sync(token: str, payload: dict[str, Any]) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        logger.error("Telegram API HTTP %s: %s", e.code, err_msg)
    except Exception as e:
        logger.error("Не вдалося відправити повідомлення в Telegram: %s", e)


async def send_order_to_manager(order_id: int, order_data: dict[str, Any], settings) -> None:
    if not settings.manager_chat_id or not settings.bot_token:
        logger.info("MANAGER_CHAT_ID або BOT_TOKEN не налаштовані, сповіщення пропущено")
        return

    items_text_list = []
    for item in order_data["items"]:
        opts_str = ""
        if item["options"]:
            opts = ", ".join(
                f"{html.escape(str(o['name']))}" + (f" ×{o['qty']}" if o['qty'] > 1 else "")
                for o in item["options"]
            )
            opts_str = f"\n   <i>↳ {opts}</i>"
        p_name = html.escape(str(item["product_name"]))
        v_label = html.escape(str(item["variant_label"]))
        items_text_list.append(
            f"• <b>{p_name}</b> ({v_label}) × {item['qty']} — {item['subtotal']:.2f} ₴{opts_str}"
        )
    items_block = "\n".join(items_text_list)

    loc_name = html.escape(str(order_data["location_name"]))
    c_name = html.escape(str(order_data["contact_name"]))
    c_phone = html.escape(str(order_data["contact_phone"]))

    fulfillment_label = (
        f"🛵 Доставка: <code>{html.escape(str(order_data['delivery_address'] or ''))}</code>"
        if order_data["fulfillment_type"] == "delivery"
        else "🛍️ Самовивіз"
    )
    scheduled_time = order_data.get("scheduled_time")
    time_label = f"⏰ <b>Час:</b> На {html.escape(str(scheduled_time))}" if scheduled_time else "⏰ <b>Час:</b> Якнайшвидше"

    if order_data["payment_method"] == "cash":
        payment_label = "💵 Готівка"
    elif order_data["payment_method"] == "card":
        payment_label = "💳 Картка (термінал)"
    elif order_data["payment_method"] == "qr":
        payment_label = "📱 QR-код (у чеку, при доставці)"
    else:
        payment_label = html.escape(str(order_data["payment_method"]))

    comment_line = (
        f"\n💬 <b>Коментар:</b> {html.escape(str(order_data['comment']))}"
        if order_data.get("comment")
        else ""
    )
    user_note = order_data.get("admin_note")
    user_note_line = (
        f"\n⚠️ <b>Примітка про клієнта:</b> {html.escape(str(user_note))}"
        if user_note
        else ""
    )

    text = (
        f"📦 <b>Нове замовлення #{order_id}</b>\n"
        f"📍 <b>Заклад:</b> {loc_name}\n"
        f"👤 <b>Клієнт:</b> {c_name} ({c_phone}){user_note_line}\n"
        f"{fulfillment_label}\n"
        f"{time_label}\n"
        f"💰 <b>Оплата:</b> {payment_label}"
        f"{comment_line}\n\n"
        f"📋 <b>Страви:</b>\n{items_block}\n\n"
        f"💵 <b>Разом до сплати: {order_data['total_price']:.2f} ₴</b>"
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "✅ Підтвердити",
                    "callback_data": f"order:confirm:{order_id}",
                },
                {
                    "text": "❌ Відхилити",
                    "callback_data": f"order:reject:{order_id}",
                },
            ]
        ]
    }

    payload = {
        "chat_id": settings.manager_chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": reply_markup,
    }

    await asyncio.to_thread(_send_telegram_notification_sync, settings.bot_token, payload)


async def _fetch_order_by_id(conn, order_id: int, telegram_id: int) -> OrderOut | None:
    order_row = await conn.fetchrow(
        """
        SELECT id, telegram_id, status, fulfillment_type, delivery_address,
               contact_name, contact_phone, payment_method, scheduled_time,
               comment, total_price, created_at
        FROM orders
        WHERE id = $1 AND telegram_id = $2
        """,
        order_id, telegram_id,
    )
    if not order_row:
        return None
    groups_rows = await conn.fetch("SELECT og.id, og.location_id, loc.name AS location_name, og.status, og.subtotal FROM order_groups og JOIN locations loc ON loc.id = og.location_id WHERE og.order_id = $1 ORDER BY og.id", order_id)
    items_rows = await conn.fetch("SELECT id, order_group_id, variant_id, product_name, variant_label, unit_price, qty, subtotal FROM order_items WHERE order_group_id = ANY($1::int[]) ORDER BY id", [g["id"] for g in groups_rows])
    options_rows = await conn.fetch("SELECT id, order_item_id, option_group_name, option_name, price_delta, qty FROM order_item_options WHERE order_item_id = ANY($1::int[]) ORDER BY id", [i["id"] for i in items_rows])
    
    opts_by_item: dict[int, list[OrderItemOptionOut]] = {}
    for r in options_rows:
        opts_by_item.setdefault(r["order_item_id"], []).append(OrderItemOptionOut(id=r["id"], option_group_name=r["option_group_name"], option_name=r["option_name"], price_delta=float(r["price_delta"]), qty=r["qty"]))
    items_by_group: dict[int, list[OrderItemOut]] = {}
    for r in items_rows:
        items_by_group.setdefault(r["order_group_id"], []).append(OrderItemOut(id=r["id"], variant_id=r["variant_id"], product_name=r["product_name"], variant_label=r["variant_label"], unit_price=float(r["unit_price"]), qty=r["qty"], subtotal=float(r["subtotal"]), options=opts_by_item.get(r["id"], [])))
    groups: list[OrderGroupOut] = [OrderGroupOut(id=g["id"], location_id=g["location_id"], location_name=g["location_name"], status=g["status"], subtotal=float(g["subtotal"]), items=items_by_group.get(g["id"], [])) for g in groups_rows]
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
        groups=groups,
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreateIn,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Створює нове замовлення з поточного кошика користувача.
    Підтримує оформлення замовлення для конкретного закладу.
    """
    settings = get_settings()
    telegram_id = user["telegram_id"]

    if user.get("is_blocked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш акаунт заблоковано адміністрацією. Оформлення замовлень недоступне.",
        )

    async with pool.acquire() as conn, conn.transaction():
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

        # Валідація часу доставки (якщо вказано)
        clean_scheduled_time = payload.scheduled_time.strip() if payload.scheduled_time else None
        if clean_scheduled_time and payload.fulfillment_type == "delivery":
            try:
                t_parts = clean_scheduled_time.split(":")
                if len(t_parts) == 2:
                    val_hour, val_min = int(t_parts[0]), int(t_parts[1])
                    val_time_str = f"{val_hour:02d}:{val_min:02d}"
                    if not (delivery_start_time <= val_time_str <= delivery_end_time):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Час доставки для «{target_location_name}» можливий лише з "
                                f"{delivery_start_time} до {delivery_end_time}."
                            ),
                        )
            except HTTPException:
                raise
            except Exception:
                pass

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
                    item_options.append({
                        "option_group_name": o_row["group_name"],
                        "name": o_row["option_name"],
                        "price_delta": delta,
                        "qty": o_row["qty"],
                    })

                eff_free = g_rows[0]["free_count"] * item["qty"]
                extra_cost += options_cost(units, eff_free)

            unit_price = float(item["price"])
            item_subtotal = round(unit_price * item["qty"] + extra_cost, 2)
            total_order_price += item_subtotal

            calculated_items.append({
                "variant_id": item["variant_id"],
                "product_name": item["product_name"],
                "variant_label": item["variant_label"],
                "unit_price": unit_price,
                "qty": item["qty"],
                "subtotal": item_subtotal,
                "options": item_options,
            })

        total_order_price = round(total_order_price, 2)

        # 5.1 Захист від дублювання замовлень (SEC-2)
        # Якщо користувач двічі натиснув кнопку або запит здублювався за останні 20 секунд:
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
            telegram_id, target_location_id, total_order_price,
        )
        if recent_order_id:
            logger.info("Повторний запит: знайдено нещодавно створене замовлення #%s", recent_order_id)
            # Отримуємо і повертаємо вже створене замовлення без створення дубля
            # Для цього транзакція завершиться без змін, і ми просто повернемо результат
            existing_order = await _fetch_order_by_id(conn, recent_order_id, telegram_id)
            if existing_order:
                return existing_order

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

        # Створення групи замовлення для закладу
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

        # Створення позицій замовлення та пакетна вставка опцій (PERF-2)
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
                options_batch.append((
                    saved_item_id,
                    opt["option_group_name"],
                    opt["name"],
                    opt["price_delta"],
                    opt["qty"],
                ))
                # Формуємо об'єкт для повернення
                options_by_item_map[saved_item_id].append(
                    OrderItemOptionOut(
                        id=0,  # ID опцій не критичний для клієнта на екрані успіху
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

        # Пакетна вставка всіх опцій одним махом (PERF-2)
        if options_batch:
            opt_insert_sql = """
                INSERT INTO order_item_options (
                    order_item_id, option_group_name, option_name, price_delta, qty
                )
                VALUES ($1, $2, $3, $4, $5)
            """
            await conn.executemany(opt_insert_sql, options_batch)

        # 7. Видаляємо оформлені позиції з кошика
        await conn.execute(
            "DELETE FROM cart_items WHERE id = ANY($1::int[])",
            target_cart_item_ids,
        )

    # 8. Сповіщення менеджера в Telegram (після успішної транзакції)
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
    }
    background_tasks.add_task(send_order_to_manager, order_id, order_notification_data, settings)

    return OrderOut(
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


@router.get("", response_model=list[OrderOut])
async def get_user_orders(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримує історію замовлень поточного користувача."""
    telegram_id = user["telegram_id"]

    orders_sql = """
        SELECT id, telegram_id, status, fulfillment_type, delivery_address,
               contact_name, contact_phone, payment_method, scheduled_time,
               comment, total_price, created_at
        FROM orders
        WHERE telegram_id = $1
        ORDER BY id DESC
    """
    groups_sql = """
        SELECT og.id, og.order_id, og.location_id, loc.name AS location_name, og.status, og.subtotal
        FROM order_groups og
        JOIN locations loc ON loc.id = og.location_id
        JOIN orders o ON o.id = og.order_id
        WHERE o.telegram_id = $1
        ORDER BY og.id
    """
    items_sql = """
        SELECT oi.id, oi.order_group_id, oi.variant_id, oi.product_name,
               oi.variant_label, oi.unit_price, oi.qty, oi.subtotal
        FROM order_items oi
        JOIN order_groups og ON og.id = oi.order_group_id
        JOIN orders o ON o.id = og.order_id
        WHERE o.telegram_id = $1
        ORDER BY oi.id
    """
    options_sql = """
        SELECT oio.id, oio.order_item_id, oio.option_group_name,
               oio.option_name, oio.price_delta, oio.qty
        FROM order_item_options oio
        JOIN order_items oi ON oi.id = oio.order_item_id
        JOIN order_groups og ON og.id = oi.order_group_id
        JOIN orders o ON o.id = og.order_id
        WHERE o.telegram_id = $1
        ORDER BY oio.id
    """

    async with pool.acquire() as conn:
        order_rows = await conn.fetch(orders_sql, telegram_id)
        if not order_rows:
            return []

        group_rows = await conn.fetch(groups_sql, telegram_id)
        item_rows = await conn.fetch(items_sql, telegram_id)
        option_rows = await conn.fetch(options_sql, telegram_id)

    opts_by_item: dict[int, list[OrderItemOptionOut]] = {}
    for r in option_rows:
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
    for r in item_rows:
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
    for g in group_rows:
        groups_by_order.setdefault(g["order_id"], []).append(
            OrderGroupOut(
                id=g["id"],
                location_id=g["location_id"],
                location_name=g["location_name"],
                status=g["status"],
                subtotal=float(g["subtotal"]),
                items=items_by_group.get(g["id"], []),
            )
        )

    return [
        OrderOut(
            id=row["id"],
            telegram_id=row["telegram_id"],
            status=row["status"],
            fulfillment_type=row["fulfillment_type"],
            delivery_address=row["delivery_address"],
            contact_name=row["contact_name"],
            contact_phone=row["contact_phone"],
            payment_method=row["payment_method"],
            scheduled_time=row["scheduled_time"],
            comment=row["comment"],
            total_price=float(row["total_price"]),
            created_at=row["created_at"],
            groups=groups_by_order.get(row["id"], []),
        )
        for row in order_rows
    ]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримує деталі конкретного замовлення поточного користувача."""
    telegram_id = user["telegram_id"]

    order_sql = """
        SELECT id, telegram_id, status, fulfillment_type, delivery_address,
               contact_name, contact_phone, payment_method, scheduled_time,
               comment, total_price, created_at
        FROM orders
        WHERE id = $1 AND telegram_id = $2
    """
    groups_sql = """
        SELECT og.id, og.location_id, loc.name AS location_name, og.status, og.subtotal
        FROM order_groups og
        JOIN locations loc ON loc.id = og.location_id
        WHERE og.order_id = $1
        ORDER BY og.id
    """
    items_sql = """
        SELECT oi.id, oi.order_group_id, oi.variant_id, oi.product_name,
               oi.variant_label, oi.unit_price, oi.qty, oi.subtotal
        FROM order_items oi
        JOIN order_groups og ON og.id = oi.order_group_id
        WHERE og.order_id = $1
        ORDER BY oi.id
    """
    options_sql = """
        SELECT oio.id, oio.order_item_id, oio.option_group_name,
               oio.option_name, oio.price_delta, oio.qty
        FROM order_item_options oio
        JOIN order_items oi ON oi.id = oio.order_item_id
        JOIN order_groups og ON og.id = oi.order_group_id
        WHERE og.order_id = $1
        ORDER BY oio.id
    """

    async with pool.acquire() as conn:
        order_row = await conn.fetchrow(order_sql, order_id, telegram_id)
        if not order_row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        group_rows = await conn.fetch(groups_sql, order_id)
        item_rows = await conn.fetch(items_sql, order_id)
        option_rows = await conn.fetch(options_sql, order_id)

    opts_by_item: dict[int, list[OrderItemOptionOut]] = {}
    for r in option_rows:
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
    for r in item_rows:
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

    groups: list[OrderGroupOut] = []
    for g in group_rows:
        groups.append(
            OrderGroupOut(
                id=g["id"],
                location_id=g["location_id"],
                location_name=g["location_name"],
                status=g["status"],
                subtotal=float(g["subtotal"]),
                items=items_by_group.get(g["id"], []),
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
        groups=groups,
    )

