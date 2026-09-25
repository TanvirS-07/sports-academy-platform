"""Shared pytest fixtures.

Tests always run against a dedicated PostgreSQL test database (academy_test), never
the development database. TEST_DATABASE_URL is copied into DATABASE_URL before the
application is imported, and a guard refuses to run against any database whose
name does not end in "_test".
"""

import os
from collections.abc import Iterator

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

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
