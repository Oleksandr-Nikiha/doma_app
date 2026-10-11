import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from src.config import get_settings
from src.db.connection import connect_db, disconnect_db, get_pool
from src.db.redis import connect_redis, disconnect_redis
from src.routers import (
    admin,
    admin_auth,
    cart,
    catalog,
    delivery_addresses,
    locations,
    orders,
    users,
)
from src.services.cache import invalidate_catalog_cache

logger = logging.getLogger(__name__)


async def _periodic_cleanup_task() -> None:
    """Періодично викликає процедуру cleanup_abandoned_carts у БД кожні 24 години."""
    while True:
        try:
            pool = get_pool()
            async with pool.acquire() as conn:
                await conn.execute("CALL cleanup_abandoned_carts(14)")
            logger.info("Процедура cleanup_abandoned_carts(14) успішно виконана.")
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Помилка виконання cleanup_abandoned_carts: %s", exc)
        await asyncio.sleep(86400)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    cleanup_task = asyncio.create_task(_periodic_cleanup_task())
    yield
    cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await cleanup_task
    from src.services.telegram_client import close_telegram_client

    await close_telegram_client()
    await disconnect_redis()
    await disconnect_db()


app = FastAPI(title="Doma Mini App API", lifespan=lifespan)

# Mini App віддається з іншого origin, ніж API (у dev — Vite на :5173,
# у проді — домен за caddy), тож CORS обов'язковий. Заголовок
# X-Telegram-Init-Data кастомний, тому allow_headers мусить його покривати.
_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auto_invalidate_catalog_cache_middleware(request: Request, call_next):
    """
    Автоматично очищає кеш каталогу при успішних змінах меню в адмінці
    (створення/редагування/видалення категорій, страв, модифікаторів чи локацій).
    """
    response = await call_next(request)
    if (
        request.method in ("POST", "PUT", "PATCH", "DELETE")
        and response.status_code < 400
    ):
        path = request.url.path
        if any(
            path.startswith(prefix)
            for prefix in (
                "/api/admin/categories",
                "/api/admin/products",
                "/api/admin/variants",
                "/api/admin/option-groups",
                "/api/admin/locations",
            )
        ):
            try:
                asyncio.create_task(invalidate_catalog_cache())
            except Exception as exc:
                logger.warning("Помилка автоматичної інвалідації кешу: %s", exc)
    return response


app.include_router(catalog.router)
app.include_router(users.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(locations.router)
app.include_router(delivery_addresses.router)
app.include_router(admin.router)
app.include_router(admin_auth.router)

class CachedStaticFiles(StaticFiles):
    """Роздача файлів із Cache-Control заголовком для браузерів та Telegram WebView."""

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=2592000, immutable"
        return response


# Роздача збережених фотографій страв
_uploads_dir = os.environ.get("UPLOADS_DIR", "/directus/uploads")
if not os.path.isdir(_uploads_dir):
    _uploads_dir = str(Path(__file__).resolve().parent.parent.parent / "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/api/uploads", CachedStaticFiles(directory=_uploads_dir), name="uploads")


@app.get("/api/health")
async def health():
    """Простий healthcheck — не звертається до БД, лише підтверджує, що процес живий."""
    return {"status": "ok"}


@app.get("/api/health/ready")
async def health_ready():
    """Детальна перевірка готовності бекенду, підключення до PostgreSQL та Redis."""
    from fastapi.responses import JSONResponse

    from src.db.redis import get_redis

    db_ok = False
    redis_ok = False
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        db_ok = True
    except Exception as exc:
        logger.warning("Health check DB error: %s", exc)

    try:
        r = get_redis()
        if r is not None:
            await r.ping()
            redis_ok = True
    except Exception as exc:
        logger.warning("Health check Redis error: %s", exc)

    is_healthy = db_ok and (redis_ok or not _settings.catalog_cache_enabled)
    status_code = 200 if is_healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_healthy else "degraded",
            "database": "connected" if db_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
        },
    )

