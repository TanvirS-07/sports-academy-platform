"""Integration tests that talk to the real PostgreSQL test database."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.db.session import get_engine

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _alembic_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


def test_connects_to_the_test_database() -> None:
    with get_engine().connect() as connection:
        database_name = connection.execute(text("SELECT current_database()")).scalar_one()
        server_version = connection.execute(text("SHOW server_version_num")).scalar_one()

    assert database_name.endswith("_test")
    assert int(server_version) >= 170000


def test_migrations_have_a_single_head() -> None:
    # Two heads means two branches of migrations were created in parallel and need merging.
    heads = ScriptDirectory.from_config(_alembic_config()).get_heads()

    assert len(heads) <= 1


def test_migrations_upgrade_and_downgrade_cleanly() -> None:
    config = _alembic_config()

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


def test_models_match_the_migrations() -> None:
    # Fails if a model was changed without creating a migration for it.
    command.check(_alembic_config())
