import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from scripts import move_session_to_past
from tests.helpers import make_coach, make_program, make_session


class _NoCloseSession:
    """Lets the script use the test session in a `with` block without closing it."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def __enter__(self) -> Session:
        return self._session

    def __exit__(self, *exc_info: object) -> None:
        return None


def _run(db: Session, args: list[str], app_env: str = "test") -> int:
    return move_session_to_past.main(
        args, session_factory=lambda: _NoCloseSession(db), app_env=lambda: app_env
    )


def test_moves_the_session_into_the_past_keeping_its_length(db_session: Session) -> None:
    session = make_session(db_session, make_program(db_session, make_coach(db_session)), hours=1.5)

    assert _run(db_session, [str(session.id)]) == 0

    db_session.refresh(session)
    now = datetime.now(UTC)
    assert now - timedelta(minutes=31) < session.ends_at < now - timedelta(minutes=29)
    assert session.ends_at - session.starts_at == timedelta(hours=1.5)


def test_refuses_to_run_in_production(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    session = make_session(db_session, make_program(db_session, make_coach(db_session)))
    starts_at = session.starts_at

    assert _run(db_session, [str(session.id)], app_env="production") == 1

    db_session.refresh(session)
    assert session.starts_at == starts_at
    assert "can't be used in production" in capsys.readouterr().err


@pytest.mark.parametrize("session_id", ["not-a-uuid", str(uuid.uuid4())])
def test_rejects_an_unknown_session(db_session: Session, session_id: str) -> None:
    assert _run(db_session, [session_id]) == 1
