from functools import lru_cache

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
    # У .env задається рядком через кому: CORS_ORIGINS=http://localhost:5173,https://app.example.com
    #
    # Тип саме str, а не list[str]: для складних типів pydantic-settings намагається
    # розпарсити значення змінної як JSON ще до валідаторів, тож рядок через кому
    # валить застосунок з SettingsError. Розбираємо самі — див. cors_origin_list().
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def cors_origin_list(self) -> list[str]:
        """CORS_ORIGINS як список, з відкинутими порожніми елементами й пробілами."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()