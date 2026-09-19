import json
import logging
from typing import Any

import redis.exceptions

from src.config import get_settings
from src.db.redis import get_redis

logger = logging.getLogger(__name__)


def is_catalog_cache_enabled() -> bool:
    """Повертає True, якщо кеш увімкнений у налаштуваннях і Redis доступний."""
    settings = get_settings()
    return bool(settings.catalog_cache_enabled and get_redis() is not None)


async def get_cached_json(key: str) -> Any | None:
    """
    Отримує десеріалізовані JSON-дані з Redis за ключем.
    Якщо кеш вимкнено, клієнт недоступний або ключ не знайдено — повертає None.
    """
    settings = get_settings()
    if not settings.catalog_cache_enabled:
        return None

    client = get_redis()
    if client is None:
        return None

    try:
        val = await client.get(key)
        if val is None:
            return None
        return json.loads(val)
    except redis.exceptions.RedisError as exc:
        logger.warning("Помилка читання з Redis для ключа %s: %s", key, exc)
        return None
    except json.JSONDecodeError as exc:
        logger.warning("Помилка декодування JSON з Redis для ключа %s: %s", key, exc)
        return None


async def set_cached_json(key: str, data: Any, ttl: int | None = None) -> bool:
    """
    Зберігає дані як JSON у Redis із заданим або стандартним TTL.
    Повертає True при успішному записі, інакше False.
    """
    settings = get_settings()
    if not settings.catalog_cache_enabled:
        return False

    client = get_redis()
    if client is None:
        return False

    effective_ttl = ttl if ttl is not None else settings.catalog_cache_ttl
    if effective_ttl <= 0:
        return False

    try:
        raw_json = json.dumps(data, ensure_ascii=False)
        await client.set(key, raw_json, ex=effective_ttl)
        return True
    except redis.exceptions.RedisError as exc:
        logger.warning("Помилка запису в Redis для ключа %s: %s", key, exc)
        return False
    except Exception as exc:
        logger.warning("Неочікувана помилка при збереженні в Redis (%s): %s", key, exc)
        return False


async def invalidate_catalog_cache(pattern: str = "catalog:*") -> int:
    """
    Видаляє всі ключі кешу каталогу за патерном (за замовчуванням 'catalog:*').
    Викликається автоматично при редагуванні меню в адмінці або вручну менеджером.
    """
    client = get_redis()
    if client is None:
        return 0

    deleted_count = 0
    try:
        keys = []
        async for key in client.scan_iter(match=pattern, count=100):
            keys.append(key)
            if len(keys) >= 200:
                deleted_count += await client.delete(*keys)
                keys = []

        if keys:
            deleted_count += await client.delete(*keys)

        logger.info("Інвалідовано %d ключ(ів) кешу за патерном '%s'", deleted_count, pattern)
        return deleted_count
    except redis.exceptions.RedisError as exc:
        logger.warning("Помилка інвалідації кешу Redis (%s): %s", pattern, exc)
        return 0

