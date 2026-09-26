"""Shared pytest fixtures.

Tests always run against a dedicated PostgreSQL test database (academy_test), never
the development database. TEST_DATABASE_URL is copied into DATABASE_URL before the
application is imported, and a guard refuses to run against any database whose
name does not end in "_test".

Each test that uses the database runs inside a transaction that is rolled back
afterwards, so tests don't see each other's data.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

_test_database_url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not _test_database_url:
    raise RuntimeError("Set TEST_DATABASE_URL to run the test suite.")

_database_name = make_url(_test_database_url).database or ""
if not _database_name.endswith("_test"):
    raise RuntimeError(
        f"Refusing to run tests against database '{_database_name}'. "
        "The test database name must end in '_test'."
    )

os.environ["DATABASE_URL"] = _test_database_url
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-that-is-long-enough")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import get_db, get_engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


@pytest.fixture
def db_session() -> Iterator[Session]:
    connection = get_engine().connect()
    transaction = connection.begin()
    # "create_savepoint" turns the app's commit()/rollback() calls into savepoints,
    # so the outer transaction can still be rolled back at the end of the test.
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    def _get_test_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
