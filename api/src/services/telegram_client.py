import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_http_client: httpx.AsyncClient | None = None


def get_telegram_client() -> httpx.AsyncClient:
    """Отримує або ініціалізує спільний асинхронний HTTP-клієнт для Telegram API."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            headers={"User-Agent": "UrbanBites-FastAPI/1.0"},

        )
    return _http_client


async def close_telegram_client() -> None:
    """Закриває спільний HTTP-клієнт при зупинці застосунку."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


async def send_telegram_message(
    bot_token: str,
    chat_id: int | str,
    text: str,
    parse_mode: str | None = "HTML",
    reply_markup: dict[str, Any] | None = None,
) -> bool:
    """
    Асинхронно надсилає текстове повідомлення у Telegram чат.
    Має fallback на звичайний текст у разі помилки розбору HTML.
    """
    client = get_telegram_client()
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            return True

        # Fallback якщо сталася помилка через некоректний HTML-тег
        if resp.status_code == 400 and parse_mode:
            logger.warning(
                "Помилка HTML-розбору для chat_id=%s, надсилаємо як простий текст", chat_id
            )
            payload.pop("parse_mode", None)
            fallback_resp = await client.post(url, json=payload)
            return fallback_resp.status_code == 200

        logger.error("Telegram API HTTP %s: %s", resp.status_code, resp.text)
        return False
    except httpx.HTTPError as exc:
        logger.error("Мережева помилка при надсиланні в Telegram (chat_id=%s): %s", chat_id, exc)
        return False
    except Exception as exc:
        logger.error("Неочікувана помилка при надсиланні в Telegram: %s", exc)
        return False


async def send_telegram_photo(
    bot_token: str,
    chat_id: int | str,
    photo_url: str,
    caption: str | None = None,
    parse_mode: str | None = "HTML",
    reply_markup: dict[str, Any] | None = None,
) -> bool:
    """Асинхронно надсилає фотографію у Telegram чат."""
    client = get_telegram_client()
    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    payload: dict[str, Any] = {"chat_id": chat_id, "photo": photo_url}
    if caption:
        payload["caption"] = caption
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            return True

        if resp.status_code == 400 and parse_mode:
            payload.pop("parse_mode", None)
            fallback_resp = await client.post(url, json=payload)
            return fallback_resp.status_code == 200

        logger.error("Telegram API HTTP %s: %s", resp.status_code, resp.text)
        return False
    except Exception as exc:
        logger.error("Помилка надсилання фото в Telegram (chat_id=%s): %s", chat_id, exc)
        return False


async def fetch_bot_username(bot_token: str) -> str | None:
    """Асинхронно запитує username бота з Telegram API."""
    client = get_telegram_client()
    url = f"https://api.telegram.org/bot{bot_token}/getMe"
    try:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and "username" in data.get("result", {}):
                return data["result"]["username"]
    except Exception as exc:
        logger.warning("Не вдалося отримати username бота через Telegram API: %s", exc)
    return None
