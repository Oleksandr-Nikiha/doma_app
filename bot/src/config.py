from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Ті самі змінні оточення, що і в API (спільний .env / env_file у docker-compose).
    Боту потрібні лише токен, URL Mini App та доступ до БД для нотифікацій.
    """

    bot_token: str
    mini_app_url: str
    database_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
