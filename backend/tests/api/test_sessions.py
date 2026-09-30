import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.programs.models import EnrolmentStatus
from app.users.models import Role
from tests.helpers import (
    auth_header,
    enrol,
    make_coach,
    make_player,
    make_program,
    make_session,
    make_user,
)

SESSIONS_URL = "/api/v1/sessions"


def _body(program_id: uuid.UUID, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "program_id": str(program_id),
        "starts_at": "2030-11-09T10:00:00+11:00",
        "ends_at": "2030-11-09T11:30:00+11:00",
        "location": "Main oval",
        "capacity": 12,
    }
    body.update(overrides)
    return body


def test_coach_creates_a_session_and_times_come_back_in_utc(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)

    response = client.post(SESSIONS_URL, json=_body(program.id), headers=auth_header(coach))

    assert response.status_code == 201
    session = response.json()
    assert session["starts_at"] == "2030-11-08T23:00:00Z"
    assert session["ends_at"] == "2030-11-09T00:30:00Z"
    assert (session["capacity"], session["booked"], session["available"]) == (12, 0, 12)
    assert session["status"] == "SCHEDULED"
    assert session["program"] == {
        "id": str(program.id),
        "name": "U14 Cricket Development",
        "coach_name": "Chris Lee",
    }


def test_times_without_an_offset_are_rejected(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    body = _body(program.id, starts_at="2030-11-09T10:00:00", ends_at="2030-11-09T11:30:00")

    response = client.post(SESSIONS_URL, json=body, headers=auth_header(coach))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "overrides",
    [
        {"ends_at": "2030-11-09T10:00:00+11:00"},
        {"ends_at": "2030-11-09T09:00:00+11:00"},
        {"starts_at": "2020-10-05T10:00:00+11:00", "ends_at": "2020-10-05T11:00:00+11:00"},
    ],
)
def test_invalid_times_are_rejected(
    client: TestClient, db_session: Session, overrides: dict[str, str]
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)

    response = client.post(
        SESSIONS_URL, json=_body(program.id, **overrides), headers=auth_header(coach)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TIMES"


@pytest.mark.parametrize("capacity", [0, -1, 101])
def test_capacity_must_be_between_1_and_100(
    client: TestClient, db_session: Session, capacity: int
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)

    response = client.post(
        SESSIONS_URL, json=_body(program.id, capacity=capacity), headers=auth_header(coach)
    )

    assert response.status_code == 422


def test_coach_cant_add_a_session_to_another_coachs_program(
    client: TestClient, db_session: Session
) -> None:
    program = make_program(db_session, make_coach(db_session, "other@example.com"))
    coach = make_coach(db_session)

    response = client.post(SESSIONS_URL, json=_body(program.id), headers=auth_header(coach))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PROGRAM_NOT_FOUND"


def test_parent_cant_create_a_session(client: TestClient, db_session: Session) -> None:
    program = make_program(db_session, make_coach(db_session))
    parent = make_user(db_session)

    response = client.post(SESSIONS_URL, json=_body(program.id), headers=auth_header(parent))

    assert response.status_code == 403


def test_coach_lists_only_their_own_upcoming_sessions(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    later = make_session(db_session, program, starts_at=datetime.now(UTC) + timedelta(days=9))
    sooner = make_session(db_session, program, starts_at=datetime.now(UTC) + timedelta(days=2))
    past = make_session(db_session, program, starts_at=datetime.now(UTC) - timedelta(days=2))
    make_session(db_session, make_program(db_session, make_coach(db_session, "other@example.com")))

    upcoming = client.get(SESSIONS_URL, headers=auth_header(coach)).json()
    everything = client.get(
        SESSIONS_URL, params={"include_past": True}, headers=auth_header(coach)
    ).json()

    assert [s["id"] for s in upcoming] == [str(sooner.id), str(later.id)]
    assert [s["id"] for s in everything] == [str(past.id), str(sooner.id), str(later.id)]


def test_sessions_can_be_filtered_by_program(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    first = make_session(db_session, make_program(db_session, coach, name="U12"))
    make_session(db_session, make_program(db_session, coach, name="U14"))

    response = client.get(
        SESSIONS_URL, params={"program_id": str(first.program_id)}, headers=auth_header(coach)
    )

    assert [s["id"] for s in response.json()] == [str(first.id)]


def test_parent_sees_upcoming_sessions_in_their_childs_active_programs(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    parent = make_user(db_session)
    player = make_player(db_session, parent)
    active = make_program(db_session, coach, name="Active")
    inactive = make_program(db_session, coach, name="Left")
    other = make_program(db_session, coach, name="Not enrolled")
    enrol(db_session, active, player)
    enrol(db_session, inactive, player).status = EnrolmentStatus.INACTIVE
    db_session.commit()

    visible = make_session(db_session, active)
    make_session(db_session, active, starts_at=datetime.now(UTC) - timedelta(days=1))
    cancelled = make_session(db_session, active, starts_at=datetime.now(UTC) + timedelta(days=8))
    client.post(f"{SESSIONS_URL}/{cancelled.id}/cancel", headers=auth_header(coach))
    make_session(db_session, inactive)
    make_session(db_session, other)

    response = client.get(SESSIONS_URL, headers=auth_header(parent))

    assert [(s["id"], s["status"]) for s in response.json()] == [
        (str(visible.id), "SCHEDULED"),
        (str(cancelled.id), "CANCELLED"),
    ]


def test_who_can_see_one_session(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    session = make_session(db_session, program)
    parent = make_user(db_session)
    enrol(db_session, program, make_player(db_session, parent))
    other_parent = make_user(db_session, email="other-parent@example.com")
    make_player(db_session, other_parent)
    other_coach = make_coach(db_session, "other@example.com")
    url = f"{SESSIONS_URL}/{session.id}"

    assert client.get(url, headers=auth_header(coach)).status_code == 200
    assert client.get(url, headers=auth_header(parent)).status_code == 200
    assert client.get(url, headers=auth_header(other_parent)).status_code == 404
    assert client.get(url, headers=auth_header(other_coach)).status_code == 404
    unknown = client.get(f"{SESSIONS_URL}/{uuid.uuid4()}", headers=auth_header(coach))
    assert unknown.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_coach_edits_a_session(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    session = make_session(db_session, make_program(db_session, coach))

    response = client.patch(
        f"{SESSIONS_URL}/{session.id}",
        json={"location": "Indoor nets", "capacity": 20},
        headers=auth_header(coach),
    )

    assert response.status_code == 200
    assert (response.json()["location"], response.json()["capacity"]) == ("Indoor nets", 20)


def test_edit_checks_the_new_end_against_the_old_start(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    session = make_session(db_session, make_program(db_session, coach))
    too_early = (session.starts_at - timedelta(minutes=30)).isoformat()

    response = client.patch(
        f"{SESSIONS_URL}/{session.id}", json={"ends_at": too_early}, headers=auth_header(coach)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TIMES"


def test_capacity_cant_go_below_the_booked_count(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    session = make_session(db_session, make_program(db_session, coach), capacity=10)
    session.booked_count = 6
    db_session.commit()

    response = client.patch(
        f"{SESSIONS_URL}/{session.id}", json={"capacity": 5}, headers=auth_header(coach)
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CAPACITY_BELOW_BOOKED"


def test_other_coach_cant_edit_or_cancel(client: TestClient, db_session: Session) -> None:
    session = make_session(db_session, make_program(db_session, make_coach(db_session)))
    other = make_coach(db_session, "other@example.com")
    url = f"{SESSIONS_URL}/{session.id}"

    assert client.patch(url, json={"capacity": 5}, headers=auth_header(other)).status_code == 404
    assert client.post(f"{url}/cancel", headers=auth_header(other)).status_code == 404


def test_coach_cancels_a_session_once(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    session = make_session(db_session, make_program(db_session, coach))
    url = f"{SESSIONS_URL}/{session.id}"

    response = client.post(f"{url}/cancel", headers=auth_header(coach))

    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
    again = client.post(f"{url}/cancel", headers=auth_header(coach))
    assert again.status_code == 409
    edit = client.patch(url, json={"capacity": 5}, headers=auth_header(coach))
    assert edit.json()["error"]["code"] == "SESSION_NOT_EDITABLE"


def test_a_session_that_has_started_cant_be_changed(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    started = datetime.now(UTC) - timedelta(minutes=10)
    session = make_session(db_session, make_program(db_session, coach), starts_at=started)
    url = f"{SESSIONS_URL}/{session.id}"

    assert client.patch(url, json={"capacity": 5}, headers=auth_header(coach)).status_code == 409
    assert client.post(f"{url}/cancel", headers=auth_header(coach)).status_code == 409


def test_database_refuses_more_bookings_than_capacity(db_session: Session) -> None:
    session = make_session(
        db_session, make_program(db_session, make_user(db_session, role=Role.COACH)), capacity=2
    )

    session.booked_count = 3
    with pytest.raises(IntegrityError, match="ck_training_sessions_not_overbooked"):
        db_session.flush()
