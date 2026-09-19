import logging

import redis.asyncio as aioredis

from src.config import get_settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def connect_redis() -> aioredis.Redis | None:
    """
    Ініціалізує клієнт Redis при старті FastAPI (lifespan).
    Якщо Redis недоступний, логує попередження й не перериває запуск сервісу,
    дозволяючи кешу та rate limiter працювати у fallback-режимі.
    """
    global _redis
    settings = get_settings()

    try:
        client: aioredis.Redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        # Перевірка з'єднання
        await client.ping()
        _redis = client
        logger.info("Успішно підключено до Redis: %s", settings.redis_url)
        return _redis
    except Exception as exc:
        logger.warning(
            "Не вдалося підключитися до Redis (%s): %s. "
            "Кешування та Rate Limiting працюватимуть у режимі прямого пропуску (fallback).",
            settings.redis_url,
            exc,
        )
        _redis = None
        return None


async def disconnect_redis() -> None:
    """Викликається при завершенні роботи FastAPI для коректного закриття пулу Redis."""
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception as exc:
            logger.debug("Помилка при закритті Redis з'єднання: %s", exc)
        _redis = None
        logger.info("З'єднання з Redis закрито.")


def get_redis() -> aioredis.Redis | None:
    """Повертає глобальний клієнт Redis (або None, якщо недоступний)."""
    return _redis

