import uuid
from datetime import UTC, datetime, timedelta

import httpx2 as httpx
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.players.models import Player
from app.programs.models import EnrolmentStatus, Program
from app.sessions.models import TrainingSession
from app.users.models import User
from tests.helpers import (
    auth_header,
    book,
    enrol,
    make_coach,
    make_player,
    make_program,
    make_session,
    make_user,
)


def book_url(session: TrainingSession) -> str:
    return f"/api/v1/sessions/{session.id}/bookings"


def cancel_url(booking_id: str) -> str:
    return f"/api/v1/bookings/{booking_id}/cancel"


def _book(
    client: TestClient, parent: User, session: TrainingSession, player: Player
) -> httpx.Response:
    return client.post(
        book_url(session), json={"player_id": str(player.id)}, headers=auth_header(parent)
    )


def _setup(db: Session, capacity: int = 10) -> tuple[User, Program, TrainingSession, User, Player]:
    coach = make_coach(db)
    program = make_program(db, coach)
    session = make_session(db, program, capacity=capacity)
    parent = make_user(db)
    player = make_player(db, parent)
    enrol(db, program, player)
    return coach, program, session, parent, player


def test_parent_books_their_child(client: TestClient, db_session: Session) -> None:
    _, _, session, parent, player = _setup(db_session)

    response = _book(client, parent, session, player)

    assert response.status_code == 201
    booking = response.json()
    assert booking["status"] == "CONFIRMED"
    assert booking["player"] == {"id": str(player.id), "first_name": "Sam", "last_name": "Taylor"}
    assert (booking["session"]["booked"], booking["session"]["available"]) == (1, 9)
    assert "date_of_birth" not in str(booking)


def test_booking_twice_returns_409(client: TestClient, db_session: Session) -> None:
    _, _, session, parent, player = _setup(db_session)

    _book(client, parent, session, player)
    response = _book(client, parent, session, player)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ALREADY_BOOKED"


def test_full_session_returns_409(client: TestClient, db_session: Session) -> None:
    _, program, session, parent, player = _setup(db_session, capacity=1)
    other_parent = make_user(db_session, email="other-parent@example.com")
    other_player = make_player(db_session, other_parent, first_name="Jo")
    enrol(db_session, program, other_player)

    assert _book(client, parent, session, player).status_code == 201
    response = _book(client, other_parent, session, other_player)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SESSION_FULL"


def test_player_must_be_actively_enrolled(client: TestClient, db_session: Session) -> None:
    _, program, session, parent, player = _setup(db_session)
    sibling = make_player(db_session, parent, first_name="Kim")
    enrol(db_session, program, sibling).status = EnrolmentStatus.INACTIVE
    db_session.commit()
    not_enrolled = make_player(db_session, parent, first_name="Lee")

    for child in (sibling, not_enrolled):
        response = _book(client, parent, session, child)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "PLAYER_NOT_ENROLLED"


def test_parent_cant_book_someone_elses_child(client: TestClient, db_session: Session) -> None:
    _, program, session, parent, _ = _setup(db_session)
    other_player = make_player(db_session, make_user(db_session, email="other@example.com"))
    enrol(db_session, program, other_player)

    response = _book(client, parent, session, other_player)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"


def test_parent_without_an_enrolled_child_cant_see_the_session(
    client: TestClient, db_session: Session
) -> None:
    _, _, session, _, _ = _setup(db_session)
    stranger = make_user(db_session, email="stranger@example.com")
    child = make_player(db_session, stranger)

    response = _book(client, stranger, session, child)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_coach_cant_book(client: TestClient, db_session: Session) -> None:
    coach, _, session, _, player = _setup(db_session)

    assert _book(client, coach, session, player).status_code == 403


def test_cancelled_or_started_sessions_cant_be_booked(
    client: TestClient, db_session: Session
) -> None:
    coach, program, session, parent, player = _setup(db_session)
    client.post(f"/api/v1/sessions/{session.id}/cancel", headers=auth_header(coach))
    started = make_session(db_session, program, starts_at=datetime.now(UTC) - timedelta(minutes=5))

    for closed in (session, started):
        response = _book(client, parent, closed, player)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "SESSION_NOT_BOOKABLE"


def test_cancelling_frees_the_place_and_the_player_can_book_again(
    client: TestClient, db_session: Session
) -> None:
    _, _, session, parent, player = _setup(db_session, capacity=1)
    booking_id = _book(client, parent, session, player).json()["id"]

    response = client.post(cancel_url(booking_id), headers=auth_header(parent))

    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
    assert response.json()["cancelled_at"] is not None
    assert response.json()["session"]["available"] == 1
    again = client.post(cancel_url(booking_id), headers=auth_header(parent))
    assert again.json()["error"]["code"] == "BOOKING_NOT_CANCELLABLE"
    assert _book(client, parent, session, player).status_code == 201


def test_coach_sees_who_is_booked_and_can_cancel_a_booking(
    client: TestClient, db_session: Session
) -> None:
    coach, _, session, parent, player = _setup(db_session)
    booking_id = _book(client, parent, session, player).json()["id"]

    roster = client.get(book_url(session), headers=auth_header(coach))

    assert roster.status_code == 200
    assert [row["player"]["first_name"] for row in roster.json()] == ["Sam"]
    assert "date_of_birth" not in str(roster.json())
    assert client.post(cancel_url(booking_id), headers=auth_header(coach)).status_code == 200
    assert client.get(book_url(session), headers=auth_header(coach)).json() == []


def test_others_cant_see_or_cancel_bookings(client: TestClient, db_session: Session) -> None:
    _, _, session, parent, player = _setup(db_session)
    booking_id = _book(client, parent, session, player).json()["id"]
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_parent = make_user(db_session, email="other-parent@example.com")

    assert client.get(book_url(session), headers=auth_header(other_coach)).status_code == 404
    assert client.get(book_url(session), headers=auth_header(parent)).status_code == 403
    for user in (other_coach, other_parent):
        response = client.post(cancel_url(booking_id), headers=auth_header(user))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "BOOKING_NOT_FOUND"
    unknown = client.post(cancel_url(str(uuid.uuid4())), headers=auth_header(parent))
    assert unknown.status_code == 404


def test_booking_cant_be_cancelled_once_the_session_has_started(
    client: TestClient, db_session: Session
) -> None:
    _, _, session, parent, player = _setup(db_session)
    booking_id = _book(client, parent, session, player).json()["id"]
    session.starts_at = datetime.now(UTC) - timedelta(minutes=5)
    db_session.commit()

    response = client.post(cancel_url(booking_id), headers=auth_header(parent))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "BOOKING_NOT_CANCELLABLE"


def test_cancelling_a_session_cancels_its_bookings(client: TestClient, db_session: Session) -> None:
    coach, _, session, parent, player = _setup(db_session)
    _book(client, parent, session, player)

    response = client.post(f"/api/v1/sessions/{session.id}/cancel", headers=auth_header(coach))

    assert (response.json()["booked"], response.json()["available"]) == (0, 10)
    bookings = client.get("/api/v1/bookings", headers=auth_header(parent)).json()
    assert [(b["status"], b["session"]["status"]) for b in bookings] == [("CANCELLED", "CANCELLED")]


def test_parent_lists_only_their_childrens_upcoming_bookings(
    client: TestClient, db_session: Session
) -> None:
    _, program, session, parent, player = _setup(db_session)
    sibling = make_player(db_session, parent, first_name="Kim")
    enrol(db_session, program, sibling)
    other_parent = make_user(db_session, email="other-parent@example.com")
    other_player = make_player(db_session, other_parent, first_name="Jo")
    enrol(db_session, program, other_player)
    _book(client, parent, session, player)
    _book(client, parent, session, sibling)
    _book(client, other_parent, session, other_player)

    everyone = client.get("/api/v1/bookings", headers=auth_header(parent)).json()
    one_child = client.get(
        "/api/v1/bookings", params={"player_id": str(sibling.id)}, headers=auth_header(parent)
    ).json()

    assert sorted(b["player"]["first_name"] for b in everyone) == ["Kim", "Sam"]
    assert [b["player"]["first_name"] for b in one_child] == ["Kim"]


def test_making_a_player_inactive_cancels_their_upcoming_bookings(
    client: TestClient, db_session: Session
) -> None:
    coach, program, session, parent, player = _setup(db_session, capacity=1)
    past = make_session(db_session, program, starts_at=datetime.now(UTC) - timedelta(days=1))
    book(db_session, past, player, parent)
    other_program = make_program(db_session, coach, name="U14 Cricket Squad")
    other_session = make_session(db_session, other_program)
    enrol(db_session, other_program, player)
    _book(client, parent, session, player)
    _book(client, parent, other_session, player)
    enrolment_url = f"/api/v1/programs/{program.id}/players/{player.id}"

    response = client.patch(enrolment_url, json={"status": "INACTIVE"}, headers=auth_header(coach))

    assert response.status_code == 200
    bookings = client.get(book_url(session), headers=auth_header(coach)).json()
    assert bookings == []
    db_session.refresh(session)
    assert session.booked_count == 0
    past_bookings = client.get(book_url(past), headers=auth_header(coach)).json()
    assert len(past_bookings) == 1
    other = client.get(book_url(other_session), headers=auth_header(coach)).json()
    assert len(other) == 1

    # Making them active again doesn't bring the booking back, but the parent can book again.
    client.patch(enrolment_url, json={"status": "ACTIVE"}, headers=auth_header(coach))
    assert client.get(book_url(session), headers=auth_header(coach)).json() == []
    assert _book(client, parent, session, player).status_code == 201
