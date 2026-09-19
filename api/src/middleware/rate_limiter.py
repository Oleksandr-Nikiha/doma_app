import logging

import redis.exceptions
from fastapi import HTTPException, Request, status

from src.config import get_settings
from src.db.redis import get_redis

logger = logging.getLogger(__name__)


async def rate_limiter(request: Request) -> None:
    """
    FastAPI Dependency для перевірки частоти запитів (Rate Limiting).
    Використовує Redis з вікном на основі client IP / X-Forwarded-For.
    Якщо Redis вимкнено або недоступний, пропускає запит (graceful fallback).
    """
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    client = get_redis()
    if client is None:
        return

    # Отримання IP клієнта з урахуванням проксі (nginx)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    key = f"rl:{client_ip}"

    try:
        current_count = await client.incr(key)
        if current_count == 1:
            await client.expire(key, settings.rate_limit_window_seconds)

        if current_count > settings.rate_limit_requests:
            ttl = await client.ttl(key)
            ttl = max(ttl, 1)
            logger.warning(
                "Rate limit перевищено для IP %s: %d запитів за вікно %ds (TTL: %ds)",
                client_ip,
                current_count,
                settings.rate_limit_window_seconds,
                ttl,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Забагато запитів. Будь ласка, зачекайте трохи перед повторною спробою.",
                headers={"Retry-After": str(ttl)},
            )
    except HTTPException:
        raise
    except redis.exceptions.RedisError as exc:
        logger.warning("Помилка Redis при перевірці rate limit (%s): %s", key, exc)
    except Exception as exc:
        logger.warning("Неочікувана помилка в rate limiter: %s", exc)

