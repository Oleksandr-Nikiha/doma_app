import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

from src.config import get_settings
from src.db.connection import connect_db, disconnect_db
from src.handlers import start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def setup_menu_button(bot: Bot, mini_app_url: str) -> None:
    """
    Ставить постійну кнопку меню (зліва від поля вводу), яка відкриває Mini App.
    Виконується на старті, тож окремо клікати в BotFather не треба.
    """
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="Меню",
            web_app=WebAppInfo(url=mini_app_url),
        )
    )


async def main() -> None:
    settings = get_settings()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(start.router)

    await connect_db()
    try:
        await setup_menu_button(bot, settings.mini_app_url)
        me = await bot.get_me()
        logger.info("Бот @%s запущено, Mini App: %s", me.username, settings.mini_app_url)

        # drop_pending_updates — щоб після рестарту не обробляти накопичену чергу
        await dp.start_polling(bot, drop_pending_updates=True)
    finally:
        await disconnect_db()
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот зупинено")
