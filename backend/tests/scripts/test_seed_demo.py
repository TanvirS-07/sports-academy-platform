from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.attendance.models import Attendance
from app.bookings.models import Booking
from app.core.security import verify_password
from app.sessions.models import SessionStatus, TrainingSession
from app.users.models import Role, User
from app.users.service import get_user_by_email
from scripts import seed_demo
from tests.helpers import make_user

NOW = datetime(2026, 9, 30, 2, 0, tzinfo=UTC)


class _NoCloseSession:
    """Lets the script use the test session in a `with` block without closing it."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def __enter__(self) -> Session:
        return self._session

    def __exit__(self, *exc_info: object) -> None:
        return None


@pytest.fixture
def run(db_session: Session):
    def _run(args: list[str]) -> int:
        return seed_demo.main(
            args, session_factory=lambda: _NoCloseSession(db_session), now=lambda: NOW
        )

    return _run


def _count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_adds_demo_accounts(run, db_session: Session, capsys: pytest.CaptureFixture[str]) -> None:
    assert run([]) == 0

    coach = get_user_by_email(db_session, "coach@example.com")
    parent = get_user_by_email(db_session, "parent@example.com")
    assert coach is not None and coach.role == Role.COACH
    assert parent is not None and parent.role == Role.PARENT
    assert verify_password(seed_demo.DEMO_PASSWORD, parent.password_hash)
    assert all(u.email.endswith("@example.com") for u in db_session.scalars(select(User)))
    assert "coach@example.com" in capsys.readouterr().out


def test_adds_sessions_before_and_after_today(run, db_session: Session) -> None:
    run([])

    sessions = db_session.scalars(select(TrainingSession)).all()
    assert any(s.starts_at < NOW for s in sessions)
    assert any(s.starts_at > NOW for s in sessions)
    assert any(s.status == SessionStatus.CANCELLED for s in sessions)


def test_booked_counts_match_the_bookings(run, db_session: Session) -> None:
    run([])

    for session in db_session.scalars(select(TrainingSession)):
        bookings = db_session.scalar(
            select(func.count()).select_from(Booking).where(Booking.session_id == session.id)
        )
        assert session.booked_count == bookings


def test_attendance_is_only_for_finished_sessions(run, db_session: Session) -> None:
    run([])

    assert _count(db_session, Attendance) > 0
    for record in db_session.scalars(select(Attendance)):
        assert record.session.ends_at < NOW


def test_refuses_when_there_are_users(
    run, db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    make_user(db_session, email="someone@example.com")

    assert run([]) == 1
    assert "--reset" in capsys.readouterr().err
    assert get_user_by_email(db_session, "coach@example.com") is None


def test_reset_replaces_existing_data(run, db_session: Session) -> None:
    make_user(db_session, email="someone@example.com")

    assert run(["--reset"]) == 0
    assert get_user_by_email(db_session, "someone@example.com") is None
    assert get_user_by_email(db_session, "coach@example.com") is not None

    users = _count(db_session, User)
    assert run(["--reset"]) == 0
    assert _count(db_session, User) == users
