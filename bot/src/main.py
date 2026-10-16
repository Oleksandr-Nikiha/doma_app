import asyncio
import contextlib
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

from src.config import get_settings
from src.db.connection import connect_db, disconnect_db, get_pool
from src.handlers import orders, start

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


async def setup_bot_commands(bot: Bot) -> None:
    """
    Реєструє список команд боту в інтерфейсі Telegram (спливаюче меню /).
    """
    await bot.set_my_commands([
        BotCommand(command="start", description="Відкрити меню та оформити замовлення"),
        BotCommand(command="verify", description="Верифікувати номер телефону"),
        BotCommand(command="admin", description="Вхід до панелі керування закладом"),
    ])


async def auto_transition_scheduled_orders(bot: Bot) -> None:
    """
    Періодично перевіряє замовлення у статусі 'confirmed' із scheduled_time.
    Якщо залишилося від -15 до 30 хв:
    - автоматично переводить замовлення у статус 'in_progress' (Готується)
    - сповіщає клієнта у Telegram
    - сповіщає групу менеджерів
    """
    while True:
        try:
            pool = get_pool()
            async with pool.acquire() as conn:
                order_rows = await conn.fetch(
                    """
                    SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                           contact_name, contact_phone, total_price, scheduled_time
                    FROM orders
                    WHERE status = 'confirmed' AND scheduled_time IS NOT NULL
                    """
                )
                for order in order_rows:
                    mins_left = orders.get_minutes_until_scheduled(order["scheduled_time"])
                    if mins_left is not None and -15 <= mins_left <= 30:
                        order_id = order["id"]
                        logger.info(
                            "Автоперехід #%s у in_progress (залишилось %.1f хв)",
                            order_id,
                            mins_left,
                        )
                        async with conn.transaction():
                            await conn.execute(
                                "UPDATE orders SET status = 'in_progress', updated_at = now() "
                                "WHERE id = $1",
                                order_id,
                            )
                            await conn.execute(
                                "UPDATE order_groups SET status = 'cooking' WHERE order_id = $1",
                                order_id,
                            )

                        # Сповіщення клієнта
                        if order["telegram_id"]:
                            client_msg = orders.get_client_status_message(
                                order_id=order_id,
                                status="in_progress",
                                fulfillment_type=order["fulfillment_type"],
                                addr=order["delivery_address"],
                                total_price=float(order["total_price"]),
                                scheduled_time=order["scheduled_time"],
                            )
                            if client_msg:
                                with contextlib.suppress(Exception):
                                    await bot.send_message(
                                        chat_id=order["telegram_id"],
                                        text=client_msg,
                                        parse_mode="HTML",
                                    )

                        # Сповіщення у групу менеджерів
                        settings = get_settings()
                        if settings.manager_chat_id:
                            is_deliv = order["fulfillment_type"] == "delivery"
                            f_type_str = "доставки" if is_deliv else "самовивозу"
                            s_time = order["scheduled_time"]
                            mgr_msg = (
                                f"👨‍🍳 <b>Замовлення #{order_id} → «Готується»!</b>\n"
                                f"⏰ До часу {f_type_str} ({s_time}) залишилось < 30 хв.\n"
                                "Починаємо приготування страв на кухні 🔥"
                            )
                            keyboard = orders.build_order_keyboard(
                                order_id=order_id,
                                status="in_progress",
                                fulfillment_type=order["fulfillment_type"],
                            )
                            with contextlib.suppress(Exception):
                                await bot.send_message(
                                    chat_id=settings.manager_chat_id,
                                    text=mgr_msg,
                                    reply_markup=keyboard,
                                    parse_mode="HTML",
                                )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Помилка у auto_transition_scheduled_orders: %s", e)

        await asyncio.sleep(30)


async def main() -> None:
    settings = get_settings()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(start.router)
    dp.include_router(orders.router)

    await connect_db()
    try:
        await setup_menu_button(bot, settings.mini_app_url)
        await setup_bot_commands(bot)
        me = await bot.get_me()
        if me.username:
            orders.set_bot_username(me.username)
            settings.bot_username = me.username
        logger.info("Бот @%s запущено, Mini App: %s", me.username, settings.mini_app_url)

        scheduler_task = asyncio.create_task(auto_transition_scheduled_orders(bot))
        try:
            # drop_pending_updates — щоб після рестарту не обробляти накопичену чергу
            await dp.start_polling(bot, drop_pending_updates=True)
        finally:
            scheduler_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await scheduler_task
    finally:
        await disconnect_db()
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот зупинено")
