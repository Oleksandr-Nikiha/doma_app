import uuid
from datetime import UTC, datetime

from aiogram import F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from src.auth.admin_token import create_admin_token
from src.config import get_settings
from src.db.connection import (
    approve_admin_session,
    get_admin_session_by_code,
    get_admin_session_by_id,
    get_manager_by_telegram_id,
    get_user_by_telegram_id,
)

router = Router(name="start")


def _open_app_keyboard(mini_app_url: str) -> InlineKeyboardMarkup:
    """Інлайн-кнопка, що відкриває Mini App. URL обов'язково має бути HTTPS."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🍕 Відкрити меню",
                    web_app=WebAppInfo(url=mini_app_url),
                )
            ]
        ]
    )


async def _process_admin_auth(message: Message, payload: str) -> bool:
    """
    Обробляє запит на підтвердження входу в адмін-панель з ПК.
    Повертає True, якщо payload розпізнано як запит авторизації.
    """
    if not message.from_user:
        return False

    clean_payload = payload.strip()
    if clean_payload.startswith("admin_"):
        clean_payload = clean_payload.removeprefix("admin_")
    elif clean_payload.startswith("login_"):
        clean_payload = clean_payload.removeprefix("login_")

    session = None

    # Спроба 1: якщо це 6-значний числовий код
    if clean_payload.isdigit() and len(clean_payload) == 6:
        session = await get_admin_session_by_code(clean_payload)
    else:
        # Спроба 2: якщо це UUID сесії
        try:
            session_uuid = uuid.UUID(clean_payload)
            session = await get_admin_session_by_id(session_uuid)
        except ValueError:
            return False

    # Перевіряємо права персоналу
    manager = await get_manager_by_telegram_id(message.from_user.id)
    if not manager:
        await message.answer(
            "⛔ <b>Доступ до адмін-панелі заборонено.</b>\n\n"
            f"Ваш акаунт Telegram (ID: <code>{message.from_user.id}</code>) не зареєстрований "
            "як активний менеджер або адміністратор закладу.\n\n"
            "Зверніться до власника або головного адміністратора для надання доступу."
        )
        return True

    if not session:
        await message.answer(
            "⚠️ <b>Сесію авторизації не знайдено або термін її дії вичерпано.</b>\n\n"
            "Будь ласка, оновіть сторінку входу на комп'ютері та спробуйте ще раз."
        )
        return True

    if session["status"] == "approved":
        await message.answer(
            "ℹ️ <b>Цей вхід вже було успішно підтверджено раніше.</b>\n\n"
            "Ви вже можете користуватися адмін-панеллю на вашому комп'ютері."
        )
        return True

    now = datetime.now(UTC)
    if session["expires_at"] < now:
        await message.answer(
            "⌛ <b>Час дії запиту на вхід вичерпано.</b>\n\n"
            "Будь ласка, оновіть сторінку входу на комп'ютері "
            "для генерації нового посилання чи коду."
        )
        return True

    settings = get_settings()
    token = create_admin_token(message.from_user.id, settings.bot_token, days=30)
    success = await approve_admin_session(session["id"], message.from_user.id, token)

    if success:
        role_title = "Головний адміністратор" if manager["role"] == "admin" else "Менеджер"
        await message.answer(
            "✅ <b>Вхід на комп'ютері успішно підтверджено!</b>\n\n"
            f"👤 <b>Користувач:</b> {manager['full_name']}\n"
            f"🔑 <b>Роль:</b> {role_title}\n\n"
            "💻 Адмін-панель у вашому браузері на ПК вже відкривається. "
            "Ви можете повернутися до роботи за великим екраном."
        )
    else:
        await message.answer(
            "❌ <b>Помилка підтвердження сесії.</b> Спробуйте оновити сторінку на комп'ютері."
        )

    return True


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    """
    Точка входу в сервіс.
    Підтримує як звичайний старт Mini App, так і deep-linking
    для входу в адмінку (start=admin_<uuid>).
    """
    if command.args:
        handled = await _process_admin_auth(message, command.args)
        if handled:
            return

    settings = get_settings()
    user = await get_user_by_telegram_id(message.from_user.id)

    if user:
        text = (
            f"Вітаємо знову, {user['full_name']}! 👋\n\n"
            "Обирайте страви з Doma Pizza та Doma Croissants — кошик чекає."
        )
    else:
        text = (
            "Вітаємо в <b>Doma</b>! 👋\n\n"
            "Тут можна замовити їжу з <b>Doma Pizza</b> та <b>Doma Croissants</b>.\n"
            "Відкрийте меню — на першому екрані попросимо ім'я, телефон і адресу доставки."
        )

    await message.answer(
        text,
        reply_markup=_open_app_keyboard(settings.mini_app_url),
    )


@router.message(Command("admin"))
async def cmd_admin(message: Message, command: CommandObject) -> None:
    """Підтвердження входу за командою /admin <code>."""
    if command.args:
        handled = await _process_admin_auth(message, command.args)
        if handled:
            return

    # Якщо викликано просто /admin без параметрів
    manager = await get_manager_by_telegram_id(message.from_user.id)
    if not manager:
        await message.answer(
            "⛔ <b>Доступ заборонено.</b>\nВи не є менеджером або адміністратором закладу."
        )
        return

    await message.answer(
        "👋 Вітаємо в системі керування закладом!\n\n"
        "Щоб увійти в адмін-панель на комп'ютері:\n"
        "1. Відкрийте сторінку входу на ПК.\n"
        "2. Натисніть кнопку «Відкрити в Telegram» або відскануйте QR-код телефоном.\n"
        "3. Або просто надішліть 6-значний код з екрана ПК сюди в чат."
    )


@router.message(F.text.regexp(r"^\d{6}$"))
async def msg_admin_code(message: Message) -> None:
    """Обробка простого введення 6-значного коду авторизації адмінки."""
    if message.text:
        handled = await _process_admin_auth(message, message.text)
        if handled:
            return
