from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from src.config import get_settings
from src.db.connection import get_user_by_telegram_id

router = Router(name="start")


def _open_app_keyboard(mini_app_url: str) -> InlineKeyboardMarkup:
    """Інлайн-кнопка, що відкриває Mini App. URL обов'язково має бути HTTPS."""
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="🍕 Відкрити меню",
                web_app=WebAppInfo(url=mini_app_url),
            )
        ]]
    )


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """
    Точка входу в сервіс. Сам бот нічого не замовляє — він лише відкриває Mini App.
    Зареєстрованого користувача вітаємо на ім'я, новому пояснюємо перший крок.
    """
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
