import uuid
from datetime import UTC, datetime

from aiogram import F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
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
    set_user_phone_verified,
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


async def _prompt_phone_verification(message: Message) -> None:
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="📱 Поділитися номером телефону",
                    request_contact=True,
                )
            ]
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await message.answer(
        "📱 <b>Верифікація номера телефону</b>\n\n"
        "Натисніть кнопку нижче, щоб безпечно підтвердити ваш номер телефону через Telegram.",
        reply_markup=kb,
    )


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    """
    Точка входу в сервіс.
    Підтримує як звичайний старт Mini App, так і deep-linking
    для входу в адмінку (start=admin_<uuid>) або верифікації телефону (start=verify_phone).
    """
    if command.args:
        handled = await _process_admin_auth(message, command.args)
        if handled:
            return
        if command.args in ("verify_phone", "verify"):
            await _prompt_phone_verification(message)
            return

    settings = get_settings()
    user = await get_user_by_telegram_id(message.from_user.id)

    if user:
        verified_badge = (
            "✅ Телефон верифіковано"
            if user.get("is_phone_verified")
            else "⚠️ Телефон не верифіковано (надішліть /verify)"
        )
        text = (
            f"Вітаємо знову, {user['full_name']}! 👋\n"
            f"({verified_badge})\n\n"
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


@router.message(Command("verify"))
@router.message(Command("phone"))
async def cmd_verify_phone(message: Message) -> None:
    """Запит на верифікацію номера телефону."""
    await _prompt_phone_verification(message)


@router.message(F.contact)
async def handle_contact(message: Message) -> None:
    """Обробка надісланого контакту для верифікації номера телефону."""
    if not message.contact or not message.from_user:
        return

    # Перевірка: контакт має належати саме тому користувачу, який його надіслав
    if message.contact.user_id != message.from_user.id:
        await message.answer(
            "⚠️ <b>Помилка верифікації!</b>\n\n"
            "Будь ласка, надішліть саме свій контакт за допомогою кнопки нижче.",
        )
        return

    raw_phone = message.contact.phone_number
    phone = raw_phone.strip()
    if not phone.startswith("+"):
        phone = f"+{phone}"

    settings = get_settings()
    success = await set_user_phone_verified(
        telegram_id=message.from_user.id,
        phone=phone,
        full_name=message.from_user.full_name,
    )

    if success:
        await message.answer(
            "✅ <b>Номер телефону успішно верифіковано!</b>\n\n"
            f"📞 <b>Ваш номер:</b> <code>{phone}</code>\n\n"
            "Тепер ваш акаунт підтверджено. Ви можете повернутися до замовлень.",
            reply_markup=ReplyKeyboardRemove(),
        )
        await message.answer(
            "🍕 Бажаєте відкрити меню?",
            reply_markup=_open_app_keyboard(settings.mini_app_url),
        )
    else:
        await message.answer(
            "❌ Не вдалося зберегти номер. Будь ласка, спробуйте пізніше.",
            reply_markup=ReplyKeyboardRemove(),
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
