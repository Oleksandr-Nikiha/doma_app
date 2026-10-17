import html
import logging
from typing import Any

from src.services.telegram_client import send_telegram_message

logger = logging.getLogger(__name__)


class OrderNotifier:
    """Сервіс формування та відправки сповіщень про замовлення."""

    @staticmethod
    def build_manager_notification(
        order_id: int, order_data: dict[str, Any], settings: Any
    ) -> tuple[str, dict[str, Any]]:
        """
        Формує HTML-текст сповіщення та inline-клавіатуру для чату менеджерів.
        Включає бейдж верифікації контакту, посилання на профіль tg:// та посилання на веб-панель.
        """
        items_text_list = []
        for item in order_data["items"]:
            opts_str = ""
            if item.get("options"):
                opts = ", ".join(
                    f"{html.escape(str(o['name']))}" + (f" ×{o['qty']}" if o["qty"] > 1 else "")
                    for o in item["options"]
                )
                opts_str = f"\n   <i>↳ {opts}</i>"
            p_name = html.escape(str(item["product_name"]))
            v_label = html.escape(str(item["variant_label"]))
            items_text_list.append(
                f"• <b>{p_name}</b> ({v_label}) × {item['qty']} — "
                f"{item['subtotal']:.2f} ₴{opts_str}"
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
        time_label = (
            f"⏰ <b>Час:</b> На {html.escape(str(scheduled_time))}"
            if scheduled_time
            else "⏰ <b>Час:</b> Якнайшвидше"
        )

        payment_method = order_data["payment_method"]
        if payment_method == "cash":
            payment_label = "💵 Готівка"
        elif payment_method == "card":
            payment_label = "💳 Картка (термінал)"
        elif payment_method == "qr":
            payment_label = "📱 QR-код (у чеку, при доставці)"
        else:
            payment_label = html.escape(str(payment_method))

        comment_line = (
            f"\n💬 <b>Коментар:</b> {html.escape(str(order_data['comment']))}"
            if order_data.get("comment")
            else ""
        )
        user_note = order_data.get("admin_note")
        user_note_line = (
            f"\n⚠️ <b>Примітка про клієнта:</b> {html.escape(str(user_note))}" if user_note else ""
        )

        tg_id = order_data.get("telegram_id")
        is_phone_verified = order_data.get("is_phone_verified", False)
        phone_badge = (
            "✅ Телефон верифіковано в TG"
            if is_phone_verified
            else (
                "⚠️ <b>НЕ ВЕРИФІКОВАНО!</b> "
                "Перед приготуванням зателефонуйте для усного підтвердження!"
            )
        )
        user_tg_line = (
            f'\n📱 <b>Telegram ID:</b> <code>{tg_id}</code> (<a href="tg://user?id={tg_id}">Профіль</a>)\n'
            f"🔒 <b>Верифікація контакту:</b> {phone_badge}"
            if tg_id
            else ""
        )

        bot_username = (
            getattr(settings, "bot_username", "urban_bites_tst_bot") or "urban_bites_tst_bot"
        )
        mini_app_url = getattr(settings, "mini_app_url", "") or "https://nikiga-ax.duckdns.org"
        app_link = f"https://t.me/{bot_username}?startapp=order_{order_id}"
        web_admin_link = f"{mini_app_url.rstrip('/')}/admin?order_id={order_id}"

        text = (
            f"📦 <b>Нове замовлення #{order_id}</b>\n"
            f"📍 <b>Заклад:</b> {loc_name}\n"
            f"👤 <b>Клієнт:</b> {c_name} ({c_phone}){user_tg_line}{user_note_line}\n"
            f"{fulfillment_label}\n"
            f"{time_label}\n"
            f"💰 <b>Оплата:</b> {payment_label}"
            f"{comment_line}\n\n"
            f"📋 <b>Страви:</b>\n{items_block}\n\n"
            f"💵 <b>Разом до сплати: {order_data['total_price']:.2f} ₴</b>\n\n"
            f'🔗 <a href="{app_link}">Відкрити у додатку</a> | '
            f'<a href="{web_admin_link}">Веб-панель</a>'
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
                ],
                [
                    {
                        "text": "⏱ Змінити час",
                        "callback_data": f"order:time_menu:{order_id}",
                    }
                ],
                [
                    {
                        "text": "✏️ Редагувати замовлення",
                        "url": app_link,
                    }
                ],
            ]
        }

        return text, reply_markup

    @classmethod
    async def send_manager_notification(
        cls, order_id: int, order_data: dict[str, Any], settings: Any
    ) -> bool:
        """Асинхронно відправляє сповіщення про замовлення у чат менеджерів."""
        if not getattr(settings, "manager_chat_id", None):
            return False

        text, reply_markup = cls.build_manager_notification(order_id, order_data, settings)
        return await send_telegram_message(
            bot_token=settings.bot_token,
            chat_id=settings.manager_chat_id,
            text=text,
            parse_mode="HTML",
            reply_markup=reply_markup,
        )

    @staticmethod
    def build_customer_notification(
        order_id: int, order_data: dict[str, Any], settings: Any
    ) -> tuple[str, dict[str, Any] | None]:
        """
        Формує повідомлення для клієнта «Ваше замовлення сформовано» та деталі замовлення.
        """
        items_text_list = []
        for item in order_data.get("items", []):
            opts_str = ""
            if item.get("options"):
                opts = ", ".join(
                    f"{html.escape(str(o['name']))}" + (f" ×{o['qty']}" if o["qty"] > 1 else "")
                    for o in item["options"]
                )
                opts_str = f"\n   <i>↳ {opts}</i>"
            p_name = html.escape(str(item["product_name"]))
            v_label = html.escape(str(item["variant_label"]))
            items_text_list.append(
                f"• <b>{p_name}</b> ({v_label}) × {item['qty']} — "
                f"{item['subtotal']:.2f} ₴{opts_str}"
            )
        items_block = "\n".join(items_text_list)

        loc_name = html.escape(str(order_data.get("location_name", "Заклад")))
        addr_clean = html.escape(str(order_data.get("delivery_address") or ""))
        fulfillment_label = (
            f"🛵 <b>Доставка:</b> <code>{addr_clean}</code>"
            if order_data.get("fulfillment_type") == "delivery"
            else "🛍️ <b>Самовивіз</b>"
        )
        scheduled_time = order_data.get("scheduled_time")
        time_label = (
            f"⏰ <b>Час:</b> На {html.escape(str(scheduled_time))}"
            if scheduled_time
            else "⏰ <b>Час:</b> Якнайшвидше"
        )

        payment_method = order_data.get("payment_method")
        if payment_method == "cash":
            payment_label = "💵 Готівка"
        elif payment_method == "card":
            payment_label = "💳 Картка при отриманні"
        elif payment_method == "qr":
            payment_label = "📱 QR-код"
        else:
            payment_label = html.escape(str(payment_method or "Оплата при отриманні"))

        comment_line = (
            f"\n💬 <b>Коментар:</b> {html.escape(str(order_data['comment']))}"
            if order_data.get("comment")
            else ""
        )

        bot_username = (
            getattr(settings, "bot_username", "urban_bites_tst_bot") or "urban_bites_tst_bot"
        )
        app_link = f"https://t.me/{bot_username}?startapp=order_{order_id}"

        text = (
            f"🎉 <b>Ваше замовлення сформовано!</b>\n\n"
            f"📦 <b>Замовлення #{order_id}</b>\n"
            f"📍 <b>Заклад:</b> {loc_name}\n"
            f"{fulfillment_label}\n"
            f"{time_label}\n"
            f"💰 <b>Оплата:</b> {payment_label}"
            f"{comment_line}\n\n"
            f"📋 <b>Склад замовлення:</b>\n{items_block}\n\n"
            f"💵 <b>Разом до сплати: {order_data.get('total_price', 0):.2f} ₴</b>\n\n"
            f"<i>Ми вже готуємо ваше замовлення! Повідомимо, щойно статус зміниться.</i>"
        )

        reply_markup = {
            "inline_keyboard": [
                [
                    {
                        "text": "🔍 Відстежити замовлення",
                        "url": app_link,
                    }
                ]
            ]
        }
        return text, reply_markup

    @classmethod
    async def send_customer_notification(
        cls,
        order_id: int,
        order_data: dict[str, Any],
        settings: Any,
        customer_telegram_id: int | None = None,
    ) -> bool:
        """Асинхронно відправляє клієнту підтвердження про формування замовлення в Telegram."""
        tg_id = customer_telegram_id or order_data.get("telegram_id")
        if not tg_id or not getattr(settings, "bot_token", None):
            return False

        text, reply_markup = cls.build_customer_notification(order_id, order_data, settings)
        return await send_telegram_message(
            bot_token=settings.bot_token,
            chat_id=tg_id,
            text=text,
            parse_mode="HTML",
            reply_markup=reply_markup,
        )
