from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.db.connection import connect_db, disconnect_db
from src.routers import cart, catalog, locations, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(title="Doma Mini App API", lifespan=lifespan)

# Mini App віддається з іншого origin, ніж API (у dev — Vite на :5173,
# у проді — домен за nginx), тож CORS обов'язковий. Заголовок
# X-Telegram-Init-Data кастомний, тому allow_headers мусить його покривати.
_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(users.router)
app.include_router(cart.router)
app.include_router(locations.router)


@app.get("/api/health")
async def health():
    """Простий healthcheck — не звертається до БД, лише підтверджує, що процес живий."""
    return {"status": "ok"}
