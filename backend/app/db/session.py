"""Database engine and request-scoped sessions."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    # pool_pre_ping discards dead connections, e.g. after the database restarts.
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that provides one database session per request."""
    with Session(get_engine()) as session:
        yield session
