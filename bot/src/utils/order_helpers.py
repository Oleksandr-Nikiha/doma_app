import contextlib
import html
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from src.config import get_settings

logger = logging.getLogger(__name__)

KYIV_TZ = ZoneInfo("Europe/Kyiv")

GROUP_STATUS_MAP = {
    "pending_moderation": "pending",
    "confirmed": "accepted",
    "in_progress": "cooking",
    "cooking": "cooking",
    "ready": "ready",
    "ready_for_pickup": "ready",
    "on_the_way": "ready",
    "delivering": "ready",
    "completed": "ready",
    "rejected": "cancelled",
    "cancelled": "cancelled",
}

STATUS_TITLES = {
    "pending_moderation": "⏳ Очікує підтвердження",
    "confirmed": "✅ Підтверджено",
    "in_progress": "👨‍🍳 Готується",
    "cooking": "👨‍🍳 Готується",
    "ready": "🛍️ Готове",
    "ready_for_pickup": "🛍️ Готове",
    "on_the_way": "🛵 В дорозі",
    "delivering": "🛵 В дорозі",
    "completed": "🏁 Виконано",
    "rejected": "❌ Відхилено",
    "cancelled": "🚫 Скасовано",
}

_cached_bot_username: str | None = None


def set_bot_username(username: str) -> None:
    """Зберігає актуальний username бота, отриманий при старті через get_me()."""
    global _cached_bot_username
    _cached_bot_username = username


def get_bot_username() -> str:
    """Повертає актуальний username бота з кешу або конфігу."""
    settings = get_settings()
    return (
        _cached_bot_username
        or getattr(settings, "bot_username", None)
        or "urban_bites_tst_bot"
    )


def get_minutes_until_scheduled(scheduled_str: str | None) -> float | None:
    """Обчислює кількість хвилин, що залишилися до запланованого часу замовлення (у Києві)."""
    if not scheduled_str or not scheduled_str.strip():
        return None
    clean = scheduled_str.strip()
    now_kyiv = datetime.now(KYIV_TZ)
    today_kyiv = now_kyiv.date()
    scheduled_dt: datetime | None = None

    # 1. YYYY-MM-DD HH:MM або YYYY-MM-DDTHH:MM (з можливими секундами)
    iso_match = re.match(r"^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})", clean)
    if iso_match:
        with contextlib.suppress(Exception):
            d_obj = datetime.strptime(iso_match.group(1), "%Y-%m-%d").date()
            h, m = map(int, iso_match.group(2).split(":"))
            scheduled_dt = datetime(d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ)

    # 2. 'Завтра, HH:MM' або 'Завтра HH:MM'
    if not scheduled_dt:
        tomorrow_match = re.match(r"^Завтра[, ]+(\d{1,2}:\d{2})$", clean, re.IGNORECASE)
        if tomorrow_match:
            with contextlib.suppress(Exception):
                t_str = tomorrow_match.group(1)
                h, m = map(int, t_str.split(":"))
                d_obj = today_kyiv + timedelta(days=1)
                scheduled_dt = datetime(d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ)

    # 3. 'Сьогодні, HH:MM' або 'Сьогодні HH:MM'
    if not scheduled_dt:
        today_match = re.match(r"^Сьогодні[, ]+(\d{1,2}:\d{2})$", clean, re.IGNORECASE)
        if today_match:
            with contextlib.suppress(Exception):
                t_str = today_match.group(1)
                h, m = map(int, t_str.split(":"))
                scheduled_dt = datetime(
                    today_kyiv.year, today_kyiv.month, today_kyiv.day, h, m, tzinfo=KYIV_TZ
                )
                if scheduled_dt < now_kyiv - timedelta(hours=6) and now_kyiv.hour >= 18 and h < 6:
                    scheduled_dt += timedelta(days=1)

    # 4. 'HH:MM'
    if not scheduled_dt:
        time_match = re.match(r"^(\d{1,2}):(\d{2})$", clean)
        if time_match:
            with contextlib.suppress(Exception):
                h, m = int(time_match.group(1)), int(time_match.group(2))
                scheduled_dt = datetime(
                    today_kyiv.year, today_kyiv.month, today_kyiv.day, h, m, tzinfo=KYIV_TZ
                )
                if scheduled_dt < now_kyiv - timedelta(hours=6) and now_kyiv.hour >= 18 and h < 6:
                    scheduled_dt += timedelta(days=1)

    if not scheduled_dt:
        return None

    return (scheduled_dt - now_kyiv).total_seconds() / 60.0


def calculate_new_time(current_scheduled: str | None, option: str) -> str | None:
    """Обчислює новий запланований час замовлення у поясі Києва."""
    if option == "asap":
        return None

    try:
        minutes_to_add = int(option.replace("+", ""))
    except ValueError:
        return None

    now_kyiv = datetime.now(KYIV_TZ)
    base_dt: datetime | None = None

    if current_scheduled:
        # 1. YYYY-MM-DD HH:MM або YYYY-MM-DDTHH:MM
        iso_match = re.search(r"(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})", current_scheduled)
        if iso_match:
            try:
                d_obj = datetime.strptime(iso_match.group(1), "%Y-%m-%d").date()
                h, m = map(int, iso_match.group(2).split(":"))
                candidate = datetime(d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ)
                if candidate >= now_kyiv - timedelta(minutes=15):
                    base_dt = candidate
            except Exception:
                base_dt = None

        # 2. 'Завтра, HH:MM'
        if not base_dt:
            tomorrow_match = re.search(
                r"Завтра[, ]+(\d{1,2}:\d{2})", current_scheduled, re.IGNORECASE
            )
            if tomorrow_match:
                try:
                    h, m = map(int, tomorrow_match.group(1).split(":"))
                    d_obj = now_kyiv.date() + timedelta(days=1)
                    candidate = datetime(d_obj.year, d_obj.month, d_obj.day, h, m, tzinfo=KYIV_TZ)
                    if candidate >= now_kyiv - timedelta(minutes=15):
                        base_dt = candidate
                except Exception:
                    base_dt = None

        # 3. 'Сьогодні, HH:MM' або 'HH:MM'
        if not base_dt:
            time_match = re.search(r"(\d{1,2}):(\d{2})", current_scheduled)
            if time_match:
                try:
                    h, m = int(time_match.group(1)), int(time_match.group(2))
                    candidate = now_kyiv.replace(hour=h, minute=m, second=0, microsecond=0)
                    if candidate < now_kyiv - timedelta(hours=6) and now_kyiv.hour >= 18 and h < 6:
                        candidate += timedelta(days=1)
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
            f"Ми почнемо готувати його своєчасно до обраного часу{time_part}. 🍕✨\n"
            f"{client_fulfillment}\n"
            f"💵 Сума: {total_price:.2f} ₴"
        )
    elif status in ("in_progress", "cooking"):
        return (
            f"👨‍🍳 <b>Замовлення #{order_id} готується!</b>\n\n"
            f"Наші кухарі вже готують ваші улюблені страви на кухні. 🔥"
        )
    elif status in ("ready", "ready_for_pickup"):
        return (
            f"🛍️ <b>Замовлення #{order_id} готове до видачі!</b>\n\n"
            f"Ваше замовлення чекає на вас у закладі. Завітайте забрати! ✨"
        )
    elif status in ("on_the_way", "delivering"):
        return (
            f"🛵 <b>Замовлення #{order_id} передано кур'єру та прямує до вас!</b>\n\n"
            f"Кур'єр уже прямує за адресою: <code>{esc_addr}</code> 💨"
        )
    elif status == "completed":
        return (
            f"🏁 <b>Замовлення #{order_id} виконано!</b>\n\n"
            f"Смачного! Дякуємо, що обираєте Urban Bites. Будемо раді бачити вас знову! ❤️"
        )
    elif status in ("rejected", "cancelled"):
        return (
            f"🚫 <b>Замовлення #{order_id} скасовано</b>\n\n"
            f"Ваше замовлення було скасовано або відхилено закладом.\n"
            f"Для деталей менеджер може зателефонувати вам."
        )
    return None


async def check_manager_permission(
    pool, user_id: int, order_id: int, chat_id: int | None = None
) -> tuple[bool, str | None]:
    """
    Перевіряє права співробітника на керування замовленням:
    1) Якщо клік здійснено в офіційному чаті/групі менеджерів (manager_chat_id) — дозволено.
    2) Якщо в приватному чаті з ботом — перевіряє таблицю managers:
       - role == 'admin': повний доступ
       - role == 'manager': доступ до замовлень свого закладу (або всіх, якщо location_id IS NULL)
    """
    settings = get_settings()
    if (
        chat_id is not None
        and settings.manager_chat_id is not None
        and chat_id == settings.manager_chat_id
    ):
        return True, None

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
        status_pattern = (
            r"\n\n(✅ <b>Підтверджено|❌ <b>Відхилено|Статус: <b>|📌 <b>Поточний статус:)[^\n]+"
        )
        text = re.sub(status_pattern, "", text)
        text = f"{text}\n\n📌 <b>Поточний статус:</b> {status_label}"

    return text
