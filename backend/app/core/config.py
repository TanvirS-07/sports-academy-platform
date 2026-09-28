"""Application settings loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The example secrets committed to this repo. Anyone can read them, so production
# refuses to start with one of them.
PUBLIC_JWT_SECRETS = frozenset(
    {
        "dev-only-jwt-secret-do-not-use-anywhere-else",
        "ci-only-jwt-secret-that-is-long-enough",
        "test-only-jwt-secret-that-is-long-enough",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sports Academy Platform"
    # No default on purpose. Development turns off the Secure cookie flag, so forgetting
    # to set this in production must stop the app instead of quietly using development.
    app_env: Literal["development", "test", "production"]

    # Example: postgresql+psycopg://academy:password@localhost:5432/academy
    database_url: str

    # Used to sign JWT access tokens. Must be at least 32 characters.
    # Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret: str = Field(min_length=32)
    access_token_expire_minutes: int = Field(default=15, ge=1, le=1440)
    # How long you stay logged in without using the site. Each refresh starts a new period.
    refresh_token_expire_days: int = Field(default=7, ge=1, le=90)

    # Comma-separated list of allowed browser origins. Empty means CORS is disabled,
    # which is the default for local development because Vite proxies /api requests.
    cors_origins: str = ""

    @model_validator(mode="after")
    def check_production_secret(self) -> "Settings":
        if self.app_env == "production" and self.jwt_secret in PUBLIC_JWT_SECRETS:
            raise ValueError("JWT_SECRET is an example value. Generate a new one for production.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
