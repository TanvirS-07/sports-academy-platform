import pytest
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.users.models import Role
from app.users.service import get_user_by_email
from scripts import create_coach
from tests.helpers import make_user

ARGS = ["--email", "Coach@Example.com", "--first-name", "Sam", "--last-name", "Lee"]


@pytest.fixture
def run(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("COACH_PASSWORD", "a-good-coach-password")

    def _run(args: list[str]) -> int:
        return create_coach.main(args, session_factory=lambda: _NoCloseSession(db_session))

    return _run


class _NoCloseSession:
    """Lets the script use the test session in a `with` block without closing it."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def __enter__(self) -> Session:
        return self._session

    def __exit__(self, *exc_info: object) -> None:
        return None


def test_creates_a_coach(run, db_session: Session, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(ARGS) == 0

    user = get_user_by_email(db_session, "coach@example.com")
    assert user is not None
    assert user.role == Role.COACH
    assert user.first_name == "Sam"
    assert verify_password("a-good-coach-password", user.password_hash)
    assert "Created coach coach@example.com" in capsys.readouterr().out


def test_refuses_a_duplicate_email(
    run, db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    make_user(db_session, email="coach@example.com")

    assert run(ARGS) == 1
    assert "already exists" in capsys.readouterr().err


def test_refuses_a_short_password(
    run, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("COACH_PASSWORD", "short")

    assert run(ARGS) == 1
    assert "Invalid input" in capsys.readouterr().err


def test_refuses_an_invalid_email(run) -> None:
    assert run(["--email", "nope", "--first-name", "Sam", "--last-name", "Lee"]) == 1


def test_prompts_for_the_password_when_the_env_var_is_not_set(
    run, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("COACH_PASSWORD")
    monkeypatch.setattr(create_coach.getpass, "getpass", lambda prompt: "typed-in-password")

    assert run(ARGS) == 0
    user = get_user_by_email(db_session, "coach@example.com")
    assert user is not None
    assert verify_password("typed-in-password", user.password_hash)


def test_refuses_mismatched_password_confirmation(run, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("COACH_PASSWORD")
    answers = iter(["first-password", "different-password"])
    monkeypatch.setattr(create_coach.getpass, "getpass", lambda prompt: next(answers))

    assert run(ARGS) == 1
