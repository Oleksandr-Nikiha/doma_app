import contextlib
import html
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from src.config import get_settings
from src.db.connection import get_pool

logger = logging.getLogger(__name__)

router = Router(name="orders")
settings = get_settings()

KYIV_TZ = ZoneInfo("Europe/Kyiv")

GROUP_STATUS_MAP = {
    "pending_moderation": "pending",
    "confirmed": "accepted",
    "in_progress": "cooking",
    "ready": "ready",
    "completed": "ready",
    "rejected": "cancelled",
    "cancelled": "cancelled",
}

STATUS_TITLES = {
    "pending_moderation": "⏳ Очікує підтвердження",
    "confirmed": "✅ Підтверджено",
    "in_progress": "👨‍🍳 Готується",
    "ready": "🛵 Готове / В дорозі",
    "completed": "🏁 Виконано",
    "rejected": "❌ Відхилено",
    "cancelled": "🚫 Скасовано",
}


def build_order_keyboard(
    order_id: int, status: str, fulfillment_type: str
) -> InlineKeyboardMarkup | None:
    """Генерує клавіатуру під повідомленням замовлення залежно від поточного статусу."""
    buttons: list[list[InlineKeyboardButton]] = []

    if status == "pending_moderation":
        buttons.append([
            InlineKeyboardButton(
                text="✅ Підтвердити",
                callback_data=f"order:status:{order_id}:confirmed",
            ),
            InlineKeyboardButton(
                text="❌ Відхилити",
                callback_data=f"order:status:{order_id}:rejected",
            ),
        ])
        buttons.append([
            InlineKeyboardButton(text="⏱ Змінити час", callback_data=f"order:time_menu:{order_id}"),
        ])
    elif status == "confirmed":
        buttons.append([
            InlineKeyboardButton(
                text="👨‍🍳 Почати готувати",
                callback_data=f"order:status:{order_id}:in_progress",
            ),
        ])
        buttons.append([
            InlineKeyboardButton(text="⏱ Змінити час", callback_data=f"order:time_menu:{order_id}"),
            InlineKeyboardButton(
                text="🚫 Скасувати",
                callback_data=f"order:status:{order_id}:cancelled",
            ),
        ])
        buttons.append([
            InlineKeyboardButton(
                text="🔄 Інший статус",
                callback_data=f"order:status_menu:{order_id}",
            ),
        ])
    elif status == "in_progress":
        ready_label = (
            "🛵 Передати кур'єру"
            if fulfillment_type == "delivery"
            else "🛍️ Готово до видачі"
        )
        buttons.append([
            InlineKeyboardButton(text=ready_label, callback_data=f"order:status:{order_id}:ready"),
        ])
        buttons.append([
            InlineKeyboardButton(text="⏱ Змінити час", callback_data=f"order:time_menu:{order_id}"),
            InlineKeyboardButton(
                text="🚫 Скасувати",
                callback_data=f"order:status:{order_id}:cancelled",
            ),
        ])
        buttons.append([
            InlineKeyboardButton(
                text="🔄 Інший статус",
                callback_data=f"order:status_menu:{order_id}",
            ),
        ])
    elif status == "ready":
        buttons.append([
            InlineKeyboardButton(
                text="🏁 Замовлення виконано",
                callback_data=f"order:status:{order_id}:completed",
            ),
        ])
        buttons.append([
            InlineKeyboardButton(text="⏱ Змінити час", callback_data=f"order:time_menu:{order_id}"),
            InlineKeyboardButton(
                text="🔄 Інший статус",
                callback_data=f"order:status_menu:{order_id}",
            ),
        ])
    else:
        # Для фінальних статусів (completed, rejected, cancelled) кнопок немає
        return None

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_time_keyboard(order_id: int) -> InlineKeyboardMarkup:
    """Клавіатура вибору швидкого часу доставки."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="+15 хв", callback_data=f"order:time_set:{order_id}:+15"),
                InlineKeyboardButton(text="+30 хв", callback_data=f"order:time_set:{order_id}:+30"),
                InlineKeyboardButton(text="+45 хв", callback_data=f"order:time_set:{order_id}:+45"),
            ],
            [
                InlineKeyboardButton(text="+1 год", callback_data=f"order:time_set:{order_id}:+60"),
                InlineKeyboardButton(
                    text="⚡ Якнайшвидше",
                    callback_data=f"order:time_set:{order_id}:asap",
                ),
            ],
            [
                InlineKeyboardButton(text="⬅️ Назад до дій", callback_data=f"order:back:{order_id}"),
            ],
        ]
    )


def build_all_statuses_keyboard(order_id: int, current_status: str) -> InlineKeyboardMarkup:
    """Клавіатура ручного вибору будь-якого доступного статусу."""
    all_statuses = [
        ("pending_moderation", "⏳ Очікує"),
        ("confirmed", "✅ Підтверджено"),
        ("in_progress", "👨‍🍳 Готується"),
        ("ready", "🛵 Готове/В дорозі"),
        ("completed", "🏁 Виконано"),
        ("cancelled", "🚫 Скасовано"),
    ]
    buttons: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for code, title in all_statuses:
        if code == current_status:
            continue
        row.append(
            InlineKeyboardButton(text=title, callback_data=f"order:status:{order_id}:{code}")
        )
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="⬅️ Назад", callback_data=f"order:back:{order_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def calculate_new_time(current_scheduled: str | None, option: str) -> str | None:
    """
    Обчислює новий запланований час замовлення у поясі Києва.
    """
    if option == "asap":
        return None

    try:
        minutes_to_add = int(option.replace("+", ""))
    except ValueError:
        return None

    now_kyiv = datetime.now(KYIV_TZ)
    base_dt: datetime | None = None

    if current_scheduled and ":" in current_scheduled:
        try:
            parts = current_scheduled.strip().split(":")
            h, m = int(parts[0]), int(parts[1])
            candidate = now_kyiv.replace(hour=h, minute=m, second=0, microsecond=0)
            if candidate >= now_kyiv - timedelta(minutes=15):
                base_dt = candidate
        except Exception:
            base_dt = None

    if not base_dt:
        base_dt = now_kyiv

    new_dt = base_dt + timedelta(minutes=minutes_to_add)
    return new_dt.strftime("%H:%M")


def get_client_status_message(
    order_id: int,
    status: str,
    fulfillment_type: str,
    addr: str | None,
    total_price: float,
    scheduled_time: str | None,
) -> str | None:
    """Генерує текст сповіщення для клієнта відповідно до статусу замовлення."""
    esc_addr = html.escape(addr or "")
    time_part = f" на {scheduled_time}" if scheduled_time else ""

    if status == "confirmed":
        client_fulfillment = (
            f"🛵 Очікуйте кур'єра{time_part} за адресою: <code>{esc_addr}</code>"
            if fulfillment_type == "delivery"
            else f"🛍️ Замовлення буде чекати на вас у закладі{time_part}!"
        )
        return (
            f"🎉 <b>Ваше замовлення #{order_id} підтверджено!</b>\n\n"
            f"Ми вже розпочали приготування. 🍕✨\n"
            f"{client_fulfillment}\n"
            f"💵 Сума: {total_price:.2f} ₴"
        )
    elif status == "in_progress":
        return (
            f"👨‍🍳 <b>Замовлення #{order_id} готується!</b>\n\n"
            f"Наші кухарі вже готують ваші улюблені страви на кухні. 🔥"
        )
    elif status == "ready":
        if fulfillment_type == "delivery":
            return (
                f"🛵 <b>Замовлення #{order_id} готове та передано кур'єру!</b>\n\n"
                f"Кур'єр уже прямує за адресою: <code>{esc_addr}</code> 💨"
            )
        else:
            return (
                f"🛍️ <b>Замовлення #{order_id} готове до видачі!</b>\n\n"
                f"Ваше замовлення чекає на вас у закладі. Завітайте забрати! ✨"
            )
    elif status == "completed":
        return (
            f"🏁 <b>Замовлення #{order_id} виконано!</b>\n\n"
            f"Смачного! Дякуємо, що обираєте Doma. Будемо раді бачити вас знову! ❤️"
        )
    elif status in ("rejected", "cancelled"):
        return (
            f"🚫 <b>Замовлення #{order_id} скасовано</b>\n\n"
            f"Ваше замовлення було скасовано або відхилено закладом.\n"
            f"Для деталей менеджер може зателефонувати вам."
        )
    return None


async def check_manager_permission(
    pool, user_id: int, order_id: int
) -> tuple[bool, str | None]:
    """
    Перевіряє права співробітника на керування замовленням за БД (таблиця managers):
    - role == 'admin': повний доступ до всіх замовлень усіх локацій
    - role == 'manager': доступ до замовлень свого закладу (або всіх, якщо location_id IS NULL)
    """
    async with pool.acquire() as conn:
        manager = await conn.fetchrow(
            """
            SELECT role, location_id, is_active
            FROM managers
            WHERE telegram_id = $1 AND is_active = true
            """,
            user_id,
        )

    if not manager:
        return (
            False,
            (
                "⛔ У вас немає прав для керування замовленнями.\n"
                f"Користувач ID: {user_id} не зареєстрований у персоналі закладу."
            ),
        )

    # Адміністратор має повний доступ до всіх закладів
    if manager["role"] == "admin":
        return True, None

    # Менеджер, закріплений за конкретним закладом
    if manager["role"] == "manager" and manager["location_id"] is not None:
        async with pool.acquire() as conn:
            loc_match = await conn.fetchval(
                "SELECT 1 FROM order_groups WHERE order_id = $1 AND location_id = $2 LIMIT 1",
                order_id,
                manager["location_id"],
            )
        if not loc_match:
            return False, "⛔ Ви можете керувати замовленнями тільки свого закладу"

    return True, None


def update_admin_message_text(
    original_text: str,
    status_label: str | None = None,
    time_label: str | None = None,
) -> str:
    """
    Оновлює текст повідомлення в адмін-групі:
    1) Замінює або додає рядок часу `⏰ Час: ...`
    2) Замінює або додає статусний рядок в кінці повідомлення
    """
    text = original_text

    # Оновлення часу
    if time_label is not None:
        time_pattern = r"(⏰ <b>Час:</b> [^\n]+)"
        new_time_line = f"⏰ <b>Час:</b> {time_label}"
        if re.search(time_pattern, text):
            text = re.sub(time_pattern, new_time_line, text)
        else:
            text = f"{text}\n{new_time_line}"

    # Оновлення або додавання статусу
    if status_label:
        # Видаляємо попередній статусний рядок, якщо він був доданий раніше
        status_pattern = (
            r"\n\n(✅ <b>Підтверджено|❌ <b>Відхилено|Статус: <b>|📌 <b>Поточний статус:)[^\n]+"
        )
        text = re.sub(status_pattern, "", text)
        text = f"{text}\n\n📌 <b>Поточний статус:</b> {status_label}"

    return text


@router.callback_query(
    F.data.startswith("order:confirm:")
    | F.data.startswith("order:reject:")
    | F.data.startswith("order:status:")
)
async def handle_order_status_change(callback: CallbackQuery) -> None:
    """
    Обробляє зміну статусу замовлення:
    - confirm/reject для зворотної сумісності зі старими кнопками
    - order:status:<order_id>:<new_status> для всіх переходів
    """
    if not callback.data:
        await callback.answer("Некоректні дані кнопки")
        return

    parts = callback.data.split(":")
    if len(parts) == 3 and parts[0] == "order" and parts[1] in ("confirm", "reject"):
        action, order_id_str = parts[1], parts[2]
        new_status = "confirmed" if action == "confirm" else "rejected"
    elif len(parts) == 4 and parts[0] == "order" and parts[1] == "status":
        order_id_str, new_status = parts[2], parts[3]
    else:
        await callback.answer("Некоректний формат команди")
        return

    try:
        order_id = int(order_id_str)
    except ValueError:
        await callback.answer("Некоректний ID замовлення")
        return

    if new_status not in GROUP_STATUS_MAP:
        await callback.answer("Невідомий статус замовлення", show_alert=True)
        return

    pool = get_pool()
    user_id = callback.from_user.id

    allowed, err_msg = await check_manager_permission(pool, user_id, order_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
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
                   contact_name, contact_phone, total_price, scheduled_time
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
        if current_status == new_status:
            status_title = STATUS_TITLES.get(new_status, new_status)
            await callback.answer(f"Замовлення вже має статус '{status_title}'")
            return

        group_status = GROUP_STATUS_MAP[new_status]

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

    # Сповіщення клієнта
    client_msg = get_client_status_message(
        order_id=order_id,
        status=new_status,
        fulfillment_type=order["fulfillment_type"],
        addr=order["delivery_address"],
        total_price=float(order["total_price"]),
        scheduled_time=order["scheduled_time"],
    )
    if client_msg and order["telegram_id"]:
        try:
            await callback.bot.send_message(
                chat_id=order["telegram_id"],
                text=client_msg,
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning("Не вдалося сповістити клієнта tg_id=%s: %s", order["telegram_id"], e)

    # Оновлення повідомлення в адмін-групі
    st_title = STATUS_TITLES.get(new_status, new_status)
    status_label = f"{st_title} (менеджер {manager_name})"
    new_keyboard = build_order_keyboard(order_id, new_status, order["fulfillment_type"])

    if callback.message:
        try:
            original_text = callback.message.html_text or callback.message.text or ""
            new_text = update_admin_message_text(original_text, status_label=status_label)
            await callback.message.edit_text(new_text, reply_markup=new_keyboard, parse_mode="HTML")
        except Exception as e:
            logger.warning("Не вдалося оновити повідомлення замовлення: %s", e)
            with contextlib.suppress(Exception):
                await callback.message.edit_reply_markup(reply_markup=new_keyboard)

    await callback.answer(f"Статус оновлено: {st_title}")


@router.callback_query(F.data.startswith("order:status_menu:"))
async def handle_order_status_menu(callback: CallbackQuery) -> None:
    """Відкриває підменю вибору будь-якого доступного статусу."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    allowed, err_msg = await check_manager_permission(pool, callback.from_user.id, order_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    async with pool.acquire() as conn:
        order = await conn.fetchrow("SELECT status FROM orders WHERE id = $1", order_id)

    if not order:
        await callback.answer("Замовлення не знайдено", show_alert=True)
        return

    keyboard = build_all_statuses_keyboard(order_id, order["status"])
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer()


@router.callback_query(F.data.startswith("order:time_menu:"))
async def handle_order_time_menu(callback: CallbackQuery) -> None:
    """Відкриває підменю швидкої зміни часу доставки."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    allowed, err_msg = await check_manager_permission(pool, callback.from_user.id, order_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    keyboard = build_time_keyboard(order_id)
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer("Оберіть новий час доставки")


@router.callback_query(F.data.startswith("order:time_set:"))
async def handle_order_time_set(callback: CallbackQuery) -> None:
    """Встановлює новий час доставки, оновлює БД, повідомлення в чаті та сповіщає клієнта."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 4:
        await callback.answer("Некоректні дані")
        return

    try:
        order_id = int(parts[2])
    except ValueError:
        await callback.answer("Некоректний ID замовлення")
        return

    option = parts[3]

    pool = get_pool()
    allowed, err_msg = await check_manager_permission(pool, callback.from_user.id, order_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    manager_name = (
        f"@{callback.from_user.username}"
        if callback.from_user.username
        else callback.from_user.full_name
    )

    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, scheduled_time, fulfillment_type
            FROM orders
            WHERE id = $1
            """,
            order_id,
        )
        if not order:
            await callback.answer("Замовлення не знайдено", show_alert=True)
            return

        current_scheduled = order["scheduled_time"]
        new_time = calculate_new_time(current_scheduled, option)

        await conn.execute(
            "UPDATE orders SET scheduled_time = $1, updated_at = now() WHERE id = $2",
            new_time,
            order_id,
        )

    # Сповіщення клієнта про зміну часу
    if order["telegram_id"]:
        time_desc = f"На {new_time}" if new_time else "Якнайшвидше"
        client_time_msg = (
            f"⏱ <b>Оновлено час для замовлення #{order_id}</b>\n\n"
            f"Новий очікуваний час доставки/видачі: <b>{time_desc}</b> 🕒\n"
            f"Дякуємо за терпіння!"
        )
        try:
            await callback.bot.send_message(
                chat_id=order["telegram_id"],
                text=client_time_msg,
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning(
                "Не вдалося сповістити клієнта tg_id=%s про зміну часу: %s",
                order["telegram_id"],
                e,
            )

    # Оновлення повідомлення в групі
    time_display = (
        f"На {new_time} (змінено {manager_name})"
        if new_time
        else f"Якнайшвидше (змінено {manager_name})"
    )
    keyboard = build_order_keyboard(order_id, order["status"], order["fulfillment_type"])

    if callback.message:
        try:
            original_text = callback.message.html_text or callback.message.text or ""
            new_text = update_admin_message_text(original_text, time_label=time_display)
            await callback.message.edit_text(new_text, reply_markup=keyboard, parse_mode="HTML")
        except Exception as e:
            logger.warning("Не вдалося оновити текст повідомлення при зміні часу: %s", e)
            with contextlib.suppress(Exception):
                await callback.message.edit_reply_markup(reply_markup=keyboard)

    resp_text = f"Час змінено на {new_time}" if new_time else "Час змінено на 'Якнайшвидше'"
    await callback.answer(resp_text)


@router.callback_query(F.data.startswith("order:back:"))
async def handle_order_back(callback: CallbackQuery) -> None:
    """Повертає користувача до головної панелі дій замовлення."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    allowed, err_msg = await check_manager_permission(pool, callback.from_user.id, order_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            "SELECT status, fulfillment_type FROM orders WHERE id = $1", order_id
        )

    if not order:
        await callback.answer("Замовлення не знайдено", show_alert=True)
        return

    keyboard = build_order_keyboard(order_id, order["status"], order["fulfillment_type"])
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer()
