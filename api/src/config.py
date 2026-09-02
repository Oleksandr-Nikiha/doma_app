from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Усі значення підтягуються зі змінних оточення (.env / docker-compose env_file).
    Імена полів (у нижньому регістрі) відповідають назвам змінних оточення без урахування регістру.
    """

    database_url: str
    redis_url: str = "redis://redis:6379/0"
    bot_token: str
    api_debug: bool = False

    # Origins, яким дозволено ходити в API з браузера (Vite у dev, домен Mini App у проді).
    # У .env задається як CORS_ORIGINS=http://localhost:5173,https://app.example.com
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        """Дозволяє задати список як звичайний рядок через кому, а не JSON."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()