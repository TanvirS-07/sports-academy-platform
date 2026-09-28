import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.notes.models import DevelopmentNote
from app.players.models import Player
from app.programs.models import EnrolmentStatus, Program
from app.users.models import User
from tests.helpers import auth_header, enrol, make_coach, make_player, make_program, make_user


def notes_url(player: Player) -> str:
    return f"/api/v1/players/{player.id}/development-notes"


def note_url(note_id: str) -> str:
    return f"/api/v1/development-notes/{note_id}"


def _note(program: Program, **fields: str) -> dict[str, str]:
    return {
        "program_id": str(program.id),
        "noted_on": date.today().isoformat(),
        "skills": "Front foot drive",
        **fields,
    }


def _setup(db: Session) -> tuple[User, Program, User, Player]:
    coach = make_coach(db)
    program = make_program(db, coach)
    parent = make_user(db)
    player = make_player(db, parent)
    enrol(db, program, player)
    return coach, program, parent, player


def test_coach_adds_a_note_and_the_parent_sees_it(client: TestClient, db_session: Session) -> None:
    coach, program, parent, player = _setup(db_session)

    response = client.post(
        notes_url(player),
        json=_note(program, improvements="  Keep the head still  ", progress=""),
        headers=auth_header(coach),
    )

    assert response.status_code == 201
    note = response.json()
    assert note["skills"] == "Front foot drive"
    assert note["improvements"] == "Keep the head still"
    assert note["progress"] == ""
    assert note["coach_id"] == str(coach.id)
    assert note["coach_name"] == "Chris Lee"
    assert note["program"] == {"id": str(program.id), "name": "U14 Cricket Development"}
    seen = client.get(notes_url(player), headers=auth_header(parent))
    assert seen.status_code == 200
    assert [n["id"] for n in seen.json()] == [note["id"]]
    assert "date_of_birth" not in str(seen.json())


def test_notes_are_newest_first(client: TestClient, db_session: Session) -> None:
    coach, program, parent, player = _setup(db_session)
    headers = auth_header(coach)
    last_week = (date.today() - timedelta(days=7)).isoformat()
    client.post(notes_url(player), json=_note(program, skills="Today"), headers=headers)
    client.post(
        notes_url(player),
        json=_note(program, skills="Earlier", noted_on=last_week),
        headers=headers,
    )

    response = client.get(notes_url(player), headers=auth_header(parent))

    assert [note["skills"] for note in response.json()] == ["Today", "Earlier"]


@pytest.mark.parametrize(
    "fields",
    [
        {"skills": "", "improvements": "", "progress": ""},
        {"skills": "   "},
        {"skills": "x" * 2001},
        {"noted_on": (date.today() + timedelta(days=3)).isoformat()},
        {"noted_on": "not a date"},
    ],
)
def test_invalid_notes_are_rejected(
    client: TestClient, db_session: Session, fields: dict[str, str]
) -> None:
    coach, program, _, player = _setup(db_session)

    response = client.post(
        notes_url(player), json=_note(program, **fields), headers=auth_header(coach)
    )

    assert response.status_code == 422


def test_player_must_be_actively_enrolled(client: TestClient, db_session: Session) -> None:
    coach, program, _, player = _setup(db_session)
    headers = auth_header(coach)
    client.patch(
        f"/api/v1/programs/{program.id}/players/{player.id}",
        json={"status": EnrolmentStatus.INACTIVE},
        headers=headers,
    )

    response = client.post(notes_url(player), json=_note(program), headers=headers)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PLAYER_NOT_ENROLLED"


def test_coach_can_only_write_in_their_own_programs(
    client: TestClient, db_session: Session
) -> None:
    coach, _, _, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_program = make_program(db_session, other_coach, name="Senior Squad")
    enrol(db_session, other_program, player)

    response = client.post(notes_url(player), json=_note(other_program), headers=auth_header(coach))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PROGRAM_NOT_FOUND"


def test_coach_only_sees_notes_from_their_own_programs(
    client: TestClient, db_session: Session
) -> None:
    coach, program, parent, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_program = make_program(db_session, other_coach, name="Senior Squad")
    enrol(db_session, other_program, player)
    client.post(notes_url(player), json=_note(program, skills="Mine"), headers=auth_header(coach))
    client.post(
        notes_url(player),
        json=_note(other_program, skills="Theirs"),
        headers=auth_header(other_coach),
    )

    mine = client.get(notes_url(player), headers=auth_header(coach)).json()
    everything = client.get(notes_url(player), headers=auth_header(parent)).json()
    filtered = client.get(
        notes_url(player), params={"program_id": str(other_program.id)}, headers=auth_header(parent)
    ).json()

    assert [note["skills"] for note in mine] == ["Mine"]
    assert sorted(note["skills"] for note in everything) == ["Mine", "Theirs"]
    assert [note["skills"] for note in filtered] == ["Theirs"]


def test_coach_still_sees_their_notes_after_the_enrolment_goes_inactive(
    client: TestClient, db_session: Session
) -> None:
    coach, program, _, player = _setup(db_session)
    headers = auth_header(coach)
    client.post(notes_url(player), json=_note(program), headers=headers)
    client.patch(
        f"/api/v1/programs/{program.id}/players/{player.id}",
        json={"status": EnrolmentStatus.INACTIVE},
        headers=headers,
    )

    response = client.get(notes_url(player), headers=headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_others_cant_see_or_add_notes(client: TestClient, db_session: Session) -> None:
    _, program, parent, player = _setup(db_session)
    other_coach = make_coach(db_session, "other-coach@example.com")
    other_parent = make_user(db_session, email="other-parent@example.com")

    for user in (other_coach, other_parent):
        response = client.get(notes_url(player), headers=auth_header(user))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"
    posted = client.post(notes_url(player), json=_note(program), headers=auth_header(other_coach))
    assert posted.status_code == 404
    as_parent = client.post(notes_url(player), json=_note(program), headers=auth_header(parent))
    assert as_parent.status_code == 403
    unknown = client.get(
        f"/api/v1/players/{uuid.uuid4()}/development-notes", headers=auth_header(parent)
    )
    assert unknown.status_code == 404


def test_only_the_author_can_edit_a_note(client: TestClient, db_session: Session) -> None:
    coach, program, parent, player = _setup(db_session)
    note_id = client.post(
        notes_url(player), json=_note(program), headers=auth_header(coach)
    ).json()["id"]
    other_coach = make_coach(db_session, "other-coach@example.com")

    edited = client.patch(
        note_url(note_id), json={"progress": "Much better balance"}, headers=auth_header(coach)
    )

    assert edited.status_code == 200
    assert edited.json()["skills"] == "Front foot drive"
    assert edited.json()["progress"] == "Much better balance"
    body = {"skills": "Changed"}
    assert (
        client.patch(note_url(note_id), json=body, headers=auth_header(other_coach)).status_code
        == 404
    )
    assert (
        client.patch(note_url(note_id), json=body, headers=auth_header(parent)).status_code == 403
    )
    unknown = client.patch(note_url(str(uuid.uuid4())), json=body, headers=auth_header(coach))
    assert unknown.json()["error"]["code"] == "NOTE_NOT_FOUND"


def test_an_edit_cant_empty_a_note(client: TestClient, db_session: Session) -> None:
    coach, program, _, player = _setup(db_session)
    note_id = client.post(
        notes_url(player), json=_note(program), headers=auth_header(coach)
    ).json()["id"]

    response = client.patch(note_url(note_id), json={"skills": ""}, headers=auth_header(coach))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "NOTE_EMPTY"


def test_database_refuses_an_empty_note(db_session: Session) -> None:
    coach, program, _, player = _setup(db_session)
    db_session.add(
        DevelopmentNote(
            player_id=player.id, program_id=program.id, coach_id=coach.id, noted_on=date.today()
        )
    )

    with pytest.raises(IntegrityError, match="ck_development_notes_not_empty"):
        db_session.flush()
