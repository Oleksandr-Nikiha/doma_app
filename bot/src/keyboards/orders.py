from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from src.utils.order_helpers import get_bot_username


def build_order_keyboard(
    order_id: int,
    status: str,
    fulfillment_type: str,
    bot_username: str | None = None,
) -> InlineKeyboardMarkup | None:
    """Генерує клавіатуру під повідомленням замовлення залежно від поточного статусу."""
    active_bot_username = bot_username or get_bot_username()
    app_link = f"https://t.me/{active_bot_username}?startapp=order_{order_id}"

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
        buttons.append([
            InlineKeyboardButton(text="✏️ Редагувати замовлення", url=app_link),
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
            InlineKeyboardButton(text="✏️ Редагувати замовлення", url=app_link),
            InlineKeyboardButton(
                text="🔄 Інший статус",
                callback_data=f"order:status_menu:{order_id}",
            ),
        ])
    elif status in ("in_progress", "cooking"):
        if fulfillment_type == "delivery":
            buttons.append([
                InlineKeyboardButton(
                    text="🛵 Передати кур'єру (В дорозі)",
                    callback_data=f"order:status:{order_id}:on_the_way",
                ),
            ])
        else:
            buttons.append([
                InlineKeyboardButton(
                    text="🛍️ Готово до видачі",
                    callback_data=f"order:status:{order_id}:ready",
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
            InlineKeyboardButton(text="✏️ Редагувати замовлення", url=app_link),
            InlineKeyboardButton(
                text="🔄 Інший статус",
                callback_data=f"order:status_menu:{order_id}",
            ),
        ])
    elif status in ("ready", "ready_for_pickup"):
        buttons.append([
            InlineKeyboardButton(
                text="🏁 Замовлення видано (Виконано)",
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
        buttons.append([
            InlineKeyboardButton(text="✏️ Редагувати замовлення", url=app_link),
        ])
    elif status in ("on_the_way", "delivering"):
        buttons.append([
            InlineKeyboardButton(
                text="🏁 Доставлено кур'єром (Виконано)",
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
        buttons.append([
            InlineKeyboardButton(text="✏️ Редагувати замовлення", url=app_link),
        ])
    else:
        # Для фінальних статусів (completed, rejected, cancelled)
        buttons.append([
            InlineKeyboardButton(text="✏️ Переглянути в додатку", url=app_link),
        ])

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


def build_all_statuses_keyboard(
    order_id: int, current_status: str, fulfillment_type: str = "delivery"
) -> InlineKeyboardMarkup:
    """Клавіатура ручного вибору будь-якого доступного статусу."""
    if fulfillment_type == "pickup":
        all_statuses = [
            ("pending_moderation", "⏳ Очікує"),
            ("confirmed", "✅ Підтверджено"),
            ("in_progress", "👨‍🍳 Готується"),
            ("ready", "🛍️ Готове"),
            ("completed", "🏁 Виконано"),
            ("cancelled", "🚫 Скасовано"),
        ]
    else:
        all_statuses = [
            ("pending_moderation", "⏳ Очікує"),
            ("confirmed", "✅ Підтверджено"),
            ("in_progress", "👨‍🍳 Готується"),
            ("on_the_way", "🛵 В дорозі"),
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
