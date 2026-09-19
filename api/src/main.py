import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.db.connection import connect_db, disconnect_db
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await disconnect_redis()
    await disconnect_db()


app = FastAPI(title="Doma Mini App API", lifespan=lifespan)

# Mini App віддається з іншого origin, ніж API (у dev — Vite на :5173,
# у проді — домен за nginx), тож CORS обов'язковий. Заголовок
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


@app.get("/api/health")
async def health():
    """Простий healthcheck — не звертається до БД, лише підтверджує, що процес живий."""
    return {"status": "ok"}
