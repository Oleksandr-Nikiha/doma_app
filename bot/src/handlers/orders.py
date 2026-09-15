import contextlib
import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery

from src.db.connection import get_pool
from src.config import get_settings

logger = logging.getLogger(__name__)

router = Router(name="orders")
settings = get_settings()


@router.callback_query(F.data.startswith("order:confirm:") | F.data.startswith("order:reject:"))
async def handle_order_moderation(callback: CallbackQuery) -> None:
    """
    Обробляє рішення менеджера щодо замовлення (Підтвердити / Відхилити).
    Змінює статус у БД, редагує повідомлення в чаті менеджера та сповіщає клієнта.
    """
    if not callback.data:
        await callback.answer("Некоректні дані кнопки")
        return

    parts = callback.data.split(":")
    if len(parts) != 3:
        await callback.answer("Некоректний формат команди")
        return

    action, order_id_str = parts[1], parts[2]
    try:
        order_id = int(order_id_str)
    except ValueError:
        await callback.answer("Некоректний ID замовлення")
        return

    pool = get_pool()
    user_id = callback.from_user.id

    # Перевірка ролі користувача через таблицю managers (з fallback на settings.managers_ids)
    async with pool.acquire() as conn:
        manager = await conn.fetchrow(
            """
            SELECT role, location_id, is_active
            FROM managers
            WHERE telegram_id = $1 AND is_active = true
            """,
            user_id,
        )

    is_env_manager = user_id in (settings.managers_ids or [])
    if not manager and not is_env_manager:
        await callback.answer("⛔ У вас немає прав для модерації замовлень", show_alert=True)
        return

    # Якщо менеджер закріплений за конкретним закладом — перевіряємо, чи замовлення належить цьому закладу
    if manager and manager["role"] == "manager" and manager["location_id"] is not None:
        async with pool.acquire() as conn:
            loc_match = await conn.fetchval(
                "SELECT 1 FROM order_groups WHERE order_id = $1 AND location_id = $2 LIMIT 1",
                order_id,
                manager["location_id"],
            )
        if not loc_match:
            await callback.answer("⛔ Це замовлення належить іншому закладу", show_alert=True)
            return

    manager_name = (
        f"@{callback.from_user.username}"
        if callback.from_user.username
        else callback.from_user.full_name
    )

    async with pool.acquire() as conn, conn.transaction():
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                   contact_name, contact_phone, total_price
            FROM orders
            WHERE id = $1
            FOR UPDATE
            """,
            order_id,
        )

        if not order:
            await callback.answer("Замовлення не знайдено в базі", show_alert=True)
            return

        current_status = order["status"]
        if current_status != "pending_moderation":
            status_labels = {
                "confirmed": "вже підтверджено",
                "rejected": "вже відхилено",
                "cancelled": "скасовано",
                "completed": "виконано",
            }
            label = status_labels.get(current_status, f"зі статусом '{current_status}'")
            await callback.answer(f"Замовлення {label}", show_alert=True)
            if callback.message:
                with contextlib.suppress(Exception):
                    await callback.message.edit_reply_markup(reply_markup=None)
            return

        if action == "confirm":
            new_status = "confirmed"
            group_status = "accepted"
            action_label = f"✅ <b>Підтверджено менеджером {manager_name}</b>"
            client_fulfillment = (
                f"🛵 Очікуйте кур'єра за адресою: <code>{order['delivery_address']}</code>"
                if order["fulfillment_type"] == "delivery"
                else "🛍️ Замовлення буде чекати на вас у закладі!"
            )
            client_msg = (
                f"🎉 <b>Ваше замовлення #{order_id} підтверджено!</b>\n\n"
                f"Дякуємо за вибір Doma! Ми вже розпочали приготування. 🍕✨\n"
                f"{client_fulfillment}\n"
                f"💵 Сума: {order['total_price']:.2f} ₴"
            )
            callback_feedback = "Замовлення успішно підтверджено!"
        else:
            new_status = "rejected"
            group_status = "cancelled"
            action_label = f"❌ <b>Відхилено менеджером {manager_name}</b>"
            client_msg = (
                f"😔 <b>Замовлення #{order_id} відхилено</b>\n\n"
                "На жаль, наразі ми не можемо виконати це замовлення.\n"
                "Найближчим часом менеджер зателефонує вам "
                f"за номером {order['contact_phone']} для уточнення."
            )
            callback_feedback = "Замовлення відхилено"

        # Оновлюємо статус замовлення та груп у БД
        await conn.execute(
            "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2",
            new_status,
            order_id,
        )
        await conn.execute(
            "UPDATE order_groups SET status = $1 WHERE order_id = $2",
            group_status,
            order_id,
        )

    # Оновлюємо повідомлення в чаті менеджера
    if callback.message:
        try:
            original_text = callback.message.html_text or callback.message.text or ""
            new_text = f"{original_text}\n\n{action_label}"
            await callback.message.edit_text(new_text, reply_markup=None, parse_mode="HTML")
        except Exception as e:
            logger.warning("Не вдалося оновити повідомлення менеджера: %s", e)

    await callback.answer(callback_feedback)

    # Сповіщаємо клієнта
    try:
        await callback.bot.send_message(
            chat_id=order["telegram_id"],
            text=client_msg,
            parse_mode="HTML",
        )
    except Exception as e:
        logger.warning(
            "Не вдалося надіслати повідомлення клієнту telegram_id=%s: %s",
            order["telegram_id"],
            e,
        )

