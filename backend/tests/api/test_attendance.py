import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.attendance.models import Attendance, AttendanceStatus
from app.players.models import Player
from app.programs.models import EnrolmentStatus, Program
from app.sessions.models import SessionStatus, TrainingSession
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


def url(session: TrainingSession) -> str:
    return f"/api/v1/sessions/{session.id}/attendance"


def player_url(player: Player) -> str:
    return f"/api/v1/players/{player.id}/attendance"


def _mark(player: Player, status: str) -> dict[str, str]:
    return {"player_id": str(player.id), "status": status}


def _started(db: Session, program: Program, days_ago: int = 0) -> TrainingSession:
    starts_at = datetime.now(UTC) - timedelta(days=days_ago, minutes=5)
    return make_session(db, program, starts_at=starts_at)


def _setup(db: Session) -> tuple[User, Program, TrainingSession, User, Player]:
    """A session that started five minutes ago, with Sam booked into it."""
    coach = make_coach(db)
    program = make_program(db, coach)
    parent = make_user(db)
    player = make_player(db, parent)
    enrol(db, program, player)
    session = _started(db, program)
    book(db, session, player, parent)
    return coach, program, session, parent, player


def test_coach_sees_booked_players_before_marking(client: TestClient, db_session: Session) -> None:
    coach, _, session, _, player = _setup(db_session)

    response = client.get(url(session), headers=auth_header(coach))

    assert response.status_code == 200
    assert response.json() == [
        {
            "player": {"id": str(player.id), "first_name": "Sam", "last_name": "Taylor"},
            "status": None,
        }
    ]


def test_coach_records_and_changes_attendance(client: TestClient, db_session: Session) -> None:
    coach, _, session, _, player = _setup(db_session)

    first = client.put(
        url(session), json={"records": [_mark(player, "ABSENT")]}, headers=auth_header(coach)
    )
    second = client.put(
        url(session), json={"records": [_mark(player, "EXCUSED")]}, headers=auth_header(coach)
    )

    assert first.status_code == 200
    assert first.json()[0]["status"] == "ABSENT"
    assert second.json()[0]["status"] == "EXCUSED"
    assert db_session.query(Attendance).filter_by(session_id=session.id).count() == 1


def test_players_left_out_keep_their_attendance(client: TestClient, db_session: Session) -> None:
    coach, program, session, parent, player = _setup(db_session)
    sibling = make_player(db_session, parent, first_name="Jo")
    enrol(db_session, program, sibling)
    book(db_session, session, sibling, parent)
    headers = auth_header(coach)

    client.put(url(session), json={"records": [_mark(player, "PRESENT")]}, headers=headers)
    response = client.put(
        url(session), json={"records": [_mark(sibling, "ABSENT")]}, headers=headers
    )

    assert {row["player"]["first_name"]: row["status"] for row in response.json()} == {
        "Jo": "ABSENT",
        "Sam": "PRESENT",
    }


def test_attendance_opens_when_the_session_starts(client: TestClient, db_session: Session) -> None:
    coach, program, _, parent, player = _setup(db_session)
    upcoming = make_session(db_session, program)
    book(db_session, upcoming, player, parent)

    response = client.put(
        url(upcoming), json={"records": [_mark(player, "PRESENT")]}, headers=auth_header(coach)
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ATTENDANCE_NOT_OPEN"


def test_cancelled_session_cant_be_marked(client: TestClient, db_session: Session) -> None:
    coach, _, session, _, player = _setup(db_session)
    session.status = SessionStatus.CANCELLED
    db_session.commit()

    response = client.put(
        url(session), json={"records": [_mark(player, "PRESENT")]}, headers=auth_header(coach)
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SESSION_CANCELLED"


def test_only_booked_players_can_be_marked(client: TestClient, db_session: Session) -> None:
    coach, program, session, parent, _ = _setup(db_session)
    not_booked = make_player(db_session, parent, first_name="Jo")
    enrol(db_session, program, not_booked)

    for player_id in (not_booked.id, uuid.uuid4()):
        response = client.put(
            url(session),
            json={"records": [{"player_id": str(player_id), "status": "PRESENT"}]},
            headers=auth_header(coach),
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "PLAYER_NOT_BOOKED"


@pytest.mark.parametrize(
    "records",
    [
        [{"player_id": "PLAYER", "status": "LATE"}],
        [{"player_id": "PLAYER", "status": "PRESENT"}, {"player_id": "PLAYER", "status": "ABSENT"}],
    ],
)
def test_invalid_records_are_rejected(
    client: TestClient, db_session: Session, records: list[dict[str, str]]
) -> None:
    coach, _, session, _, player = _setup(db_session)
    for record in records:
        record["player_id"] = str(player.id)

    response = client.put(url(session), json={"records": records}, headers=auth_header(coach))

    assert response.status_code == 422


def test_only_the_sessions_coach_can_see_or_record_attendance(
    client: TestClient, db_session: Session
) -> None:
    _, _, session, parent, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    body = {"records": [_mark(player, "PRESENT")]}

    assert client.get(url(session), headers=auth_header(other_coach)).status_code == 404
    assert client.put(url(session), json=body, headers=auth_header(other_coach)).status_code == 404
    assert client.get(url(session), headers=auth_header(parent)).status_code == 403
    assert client.put(url(session), json=body, headers=auth_header(parent)).status_code == 403


def test_parent_sees_their_childs_attendance_newest_first(
    client: TestClient, db_session: Session
) -> None:
    coach, program, session, parent, player = _setup(db_session)
    older = _started(db_session, program, days_ago=7)
    book(db_session, older, player, parent)
    headers = auth_header(coach)
    client.put(url(older), json={"records": [_mark(player, "ABSENT")]}, headers=headers)
    client.put(url(session), json={"records": [_mark(player, "PRESENT")]}, headers=headers)

    response = client.get(player_url(player), headers=auth_header(parent))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == {"present": 1, "absent": 1, "excused": 0, "total": 2}
    assert [record["status"] for record in body["records"]] == ["PRESENT", "ABSENT"]
    assert body["records"][0]["session"]["id"] == str(session.id)
    assert body["records"][0]["session"]["program"]["name"] == "U14 Cricket Development"
    assert body["records"][0]["session"]["starts_at"].endswith("Z")
    assert "date_of_birth" not in str(body)


def test_coach_only_sees_attendance_from_their_own_programs(
    client: TestClient, db_session: Session
) -> None:
    coach, _, session, parent, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_program = make_program(db_session, other_coach, name="Senior Squad")
    enrol(db_session, other_program, player)
    other_session = _started(db_session, other_program)
    book(db_session, other_session, player, parent)
    client.put(
        url(session), json={"records": [_mark(player, "PRESENT")]}, headers=auth_header(coach)
    )
    client.put(
        url(other_session),
        json={"records": [_mark(player, "ABSENT")]},
        headers=auth_header(other_coach),
    )

    mine = client.get(player_url(player), headers=auth_header(coach)).json()
    everything = client.get(player_url(player), headers=auth_header(parent)).json()

    assert [record["status"] for record in mine["records"]] == ["PRESENT"]
    assert mine["summary"]["total"] == 1
    assert everything["summary"]["total"] == 2


def test_attendance_can_be_filtered_by_program(client: TestClient, db_session: Session) -> None:
    coach, program, session, parent, player = _setup(db_session)
    second_program = make_program(db_session, coach, name="Senior Squad")
    enrol(db_session, second_program, player)
    other = _started(db_session, second_program)
    book(db_session, other, player, parent)
    headers = auth_header(coach)
    client.put(url(session), json={"records": [_mark(player, "PRESENT")]}, headers=headers)
    client.put(url(other), json={"records": [_mark(player, "ABSENT")]}, headers=headers)

    response = client.get(
        player_url(player), params={"program_id": str(program.id)}, headers=headers
    )

    assert [record["status"] for record in response.json()["records"]] == ["PRESENT"]


def test_coach_still_sees_attendance_after_the_enrolment_goes_inactive(
    client: TestClient, db_session: Session
) -> None:
    coach, program, session, _, player = _setup(db_session)
    headers = auth_header(coach)
    client.put(url(session), json={"records": [_mark(player, "PRESENT")]}, headers=headers)
    made_inactive = client.patch(
        f"/api/v1/programs/{program.id}/players/{player.id}",
        json={"status": EnrolmentStatus.INACTIVE},
        headers=headers,
    )
    assert made_inactive.status_code == 200

    response = client.get(player_url(player), headers=headers)

    assert response.status_code == 200
    assert response.json()["summary"]["total"] == 1


def test_others_cant_see_a_players_attendance(client: TestClient, db_session: Session) -> None:
    _, _, _, _, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_parent = make_user(db_session, email="other-parent@example.com")

    for user in (other_coach, other_parent):
        response = client.get(player_url(player), headers=auth_header(user))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"
    unknown = client.get(
        f"/api/v1/players/{uuid.uuid4()}/attendance", headers=auth_header(other_parent)
    )
    assert unknown.status_code == 404


def test_database_allows_one_record_per_player_per_session(db_session: Session) -> None:
    coach, _, session, _, player = _setup(db_session)
    for status in (AttendanceStatus.PRESENT, AttendanceStatus.ABSENT):
        db_session.add(
            Attendance(
                session_id=session.id, player_id=player.id, status=status, recorded_by=coach.id
            )
        )

    with pytest.raises(IntegrityError, match="uq_attendance_session_id"):
        db_session.flush()
