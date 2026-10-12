import json
from unittest.mock import AsyncMock, patch

import pytest
import redis.exceptions
from fastapi import HTTPException
from starlette.requests import Request

from src.middleware.rate_limiter import rate_limiter
from src.services.cache import (
    get_cached_json,
    invalidate_catalog_cache,
    is_catalog_cache_enabled,
    set_cached_json,
)


class TestCacheService:
    """Тестування сервісу кешування каталогу в Redis (PERF-3)."""

    def test_is_catalog_cache_enabled_with_redis(self):
        with patch("src.services.cache.get_redis") as mock_get_redis:
            mock_get_redis.return_value = AsyncMock()
            assert is_catalog_cache_enabled() is True

    def test_is_catalog_cache_enabled_without_redis(self):
        with patch("src.services.cache.get_redis") as mock_get_redis:
            mock_get_redis.return_value = None
            assert is_catalog_cache_enabled() is False

    async def test_get_cached_json_hit(self):
        mock_client = AsyncMock()
        mock_client.get.return_value = json.dumps({"categories": [{"id": 1, "name": "Піца"}]})

        with patch("src.services.cache.get_redis", return_value=mock_client):
            data = await get_cached_json("catalog:categories")
            assert data == {"categories": [{"id": 1, "name": "Піца"}]}

    async def test_get_cached_json_miss(self):
        mock_client = AsyncMock()
        mock_client.get.return_value = None

        with patch("src.services.cache.get_redis", return_value=mock_client):
            data = await get_cached_json("catalog:unknown")
            assert data is None

    async def test_get_cached_json_redis_error_fallback(self):
        """При помилці Redis сервіс повертає None і не ламає виконання (graceful fallback)."""
        mock_client = AsyncMock()
        mock_client.get.side_effect = redis.exceptions.ConnectionError("Redis connection failed")

        with patch("src.services.cache.get_redis", return_value=mock_client):
            data = await get_cached_json("catalog:categories")
            assert data is None

    async def test_set_cached_json_success(self):
        mock_client = AsyncMock()

        with patch("src.services.cache.get_redis", return_value=mock_client):
            success = await set_cached_json("catalog:test", {"key": "val"}, ttl=60)
            assert success is True
            mock_client.set.assert_called_once()

    async def test_set_cached_json_redis_error_fallback(self):
        mock_client = AsyncMock()
        mock_client.set.side_effect = redis.exceptions.ConnectionError("Failed")

        with patch("src.services.cache.get_redis", return_value=mock_client):
            success = await set_cached_json("catalog:test", {"key": "val"})
            assert success is False

    async def test_invalidate_catalog_cache(self):
        mock_client = AsyncMock()

        async def fake_scan_iter(match, count):
            yield "catalog:cat:1"
            yield "catalog:cat:2"

        mock_client.scan_iter = fake_scan_iter
        mock_client.delete.return_value = 2

        with patch("src.services.cache.get_redis", return_value=mock_client):
            deleted = await invalidate_catalog_cache("catalog:*")
            assert deleted == 2


class TestRateLimiterMiddleware:
    """Тестування захисту від перевантаження та спаму (Rate Limiting)."""

    def _make_request(self, client_ip: str = "127.0.0.1") -> Request:
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/categories",
            "headers": [(b"x-forwarded-for", client_ip.encode("utf-8"))],
            "client": (client_ip, 12345),
        }
        return Request(scope)

    async def test_rate_limiter_allows_under_limit(self):
        mock_client = AsyncMock()
        mock_client.incr.return_value = 5  # 5-й запит із 120 дозволених

        req = self._make_request()
        with patch("src.middleware.rate_limiter.get_redis", return_value=mock_client):
            # Не повинно кидати виключень
            await rate_limiter(req)

    async def test_rate_limiter_sets_ttl_on_first_request(self):
        mock_client = AsyncMock()
        mock_client.incr.return_value = 1  # 1-й запит

        req = self._make_request()
        with patch("src.middleware.rate_limiter.get_redis", return_value=mock_client):
            await rate_limiter(req)
            mock_client.expire.assert_called_once()

    async def test_rate_limiter_exceeds_limit_raises_429(self):
        mock_client = AsyncMock()
        mock_client.incr.return_value = 121  # Перевищено ліміт (120)
        mock_client.ttl.return_value = 45

        req = self._make_request()
        with patch("src.middleware.rate_limiter.get_redis", return_value=mock_client):
            with pytest.raises(HTTPException) as exc_info:
                await rate_limiter(req)

            assert exc_info.value.status_code == 429
            assert "Забагато запитів" in exc_info.value.detail
            assert exc_info.value.headers.get("Retry-After") == "45"

    async def test_rate_limiter_redis_failure_graceful_fallback(self):
        """Якщо Redis лежить, запит не падає з 500, а пропускається далі."""
        mock_client = AsyncMock()
        mock_client.incr.side_effect = redis.exceptions.ConnectionError("Redis offline")

        req = self._make_request()
        with patch("src.middleware.rate_limiter.get_redis", return_value=mock_client):
            # Повинно пройти без помилки
            await rate_limiter(req)

    async def test_rate_limiter_extracts_last_ip_from_x_forwarded_for(self):
        """Захист SEC-04: береться останній IP, доданий надійним зворотним проксі Caddy."""
        mock_client = AsyncMock()
        mock_client.incr.return_value = 1

        req = self._make_request(client_ip="spoofed.client.ip, 192.168.1.50")
        with patch("src.middleware.rate_limiter.get_redis", return_value=mock_client):
            await rate_limiter(req)
            mock_client.incr.assert_called_with("rl:192.168.1.50")
