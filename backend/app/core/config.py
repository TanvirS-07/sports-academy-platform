"""Application settings loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sports Academy Platform"
    app_env: Literal["development", "test", "production"] = "development"

    # Example: postgresql+psycopg://academy:password@localhost:5432/academy
    database_url: str

    # Used to sign JWT access tokens. Must be at least 32 characters.
    # Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret: str = Field(min_length=32)
    access_token_expire_minutes: int = Field(default=15, ge=1, le=1440)

    # Comma-separated list of allowed browser origins. Empty means CORS is disabled,
    # which is the default for local development because Vite proxies /api requests.
    cors_origins: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
