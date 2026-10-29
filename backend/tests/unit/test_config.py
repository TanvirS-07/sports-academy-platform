import pytest
from pydantic import ValidationError

from app.core.config import Settings

DATABASE_URL = "postgresql+psycopg://academy:password@localhost:5432/academy"
EXAMPLE_SECRET = "dev-only-jwt-secret-do-not-use-anywhere-else"


def _settings(**values: str) -> Settings:
    return Settings(_env_file=None, database_url=DATABASE_URL, **values)  # type: ignore[arg-type]


def test_production_refuses_the_example_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET is an example value"):
        _settings(app_env="production", jwt_secret=EXAMPLE_SECRET)


def test_production_accepts_a_new_jwt_secret() -> None:
    settings = _settings(
        app_env="production", jwt_secret="a-freshly-generated-secret-for-production"
    )

    assert settings.app_env == "production"


def test_development_can_use_the_example_jwt_secret() -> None:
    assert _settings(app_env="development", jwt_secret=EXAMPLE_SECRET).app_env == "development"


def test_app_env_must_be_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)

    with pytest.raises(ValidationError, match="app_env"):
        _settings(jwt_secret=EXAMPLE_SECRET)


def test_google_login_is_off_by_default() -> None:
    assert not _settings(app_env="development", jwt_secret=EXAMPLE_SECRET).google_login_enabled


def test_google_login_needs_the_id_secret_and_redirect_uri() -> None:
    google = {
        "google_client_id": "client-id.apps.googleusercontent.com",
        "google_client_secret": "client-secret",
        "google_redirect_uri": "http://localhost:5173/api/v1/auth/google/callback",
    }

    for missing in google:
        partial = {key: value for key, value in google.items() if key != missing}
        settings = _settings(app_env="development", jwt_secret=EXAMPLE_SECRET, **partial)
        assert not settings.google_login_enabled, f"enabled without {missing}"

    settings = _settings(app_env="development", jwt_secret=EXAMPLE_SECRET, **google)
    assert settings.google_login_enabled
