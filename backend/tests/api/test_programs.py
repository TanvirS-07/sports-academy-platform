import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import Role
from tests.helpers import auth_header, cricket, make_program, make_user

PROGRAMS_URL = "/api/v1/programs"


def new_program(db: Session) -> dict[str, str]:
    return {
        "name": "U14 Cricket Development",
        "sport_id": str(cricket(db).id),
        "age_group": "Under 14",
        "description": "Batting and bowling basics",
        "objectives": "Build a solid forward defence",
    }


def test_sports_list_includes_cricket(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    response = client.get("/api/v1/sports", headers=auth_header(parent))

    assert response.status_code == 200
    assert [sport["name"] for sport in response.json()] == ["Cricket"]


def test_coach_can_create_a_program(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)

    response = client.post(PROGRAMS_URL, json=new_program(db_session), headers=auth_header(coach))

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "U14 Cricket Development"
    assert body["sport"]["name"] == "Cricket"
    assert body["objectives"] == "Build a solid forward defence"

    listed = client.get(PROGRAMS_URL, headers=auth_header(coach)).json()
    assert [program["id"] for program in listed] == [body["id"]]


def test_description_and_objectives_are_optional(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)
    data = new_program(db_session)
    del data["description"], data["objectives"]

    response = client.post(PROGRAMS_URL, json=data, headers=auth_header(coach))

    assert response.status_code == 201
    assert response.json()["description"] == ""


def test_unknown_sport_is_rejected(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)
    data = {**new_program(db_session), "sport_id": str(uuid.uuid4())}

    response = client.post(PROGRAMS_URL, json=data, headers=auth_header(coach))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SPORT_NOT_FOUND"


def test_coach_can_edit_their_program(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)
    program = make_program(db_session, coach)

    response = client.patch(
        f"{PROGRAMS_URL}/{program.id}",
        json={"name": "U15 Cricket Development", "age_group": "Under 15"},
        headers=auth_header(coach),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "U15 Cricket Development"
    assert response.json()["age_group"] == "Under 15"


def test_coach_only_sees_their_own_programs(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)
    other_coach = make_user(db_session, email="other-coach@example.com", role=Role.COACH)
    make_program(db_session, coach, name="Mine")
    other_program = make_program(db_session, other_coach, name="Theirs")

    listed = client.get(PROGRAMS_URL, headers=auth_header(coach)).json()
    url = f"{PROGRAMS_URL}/{other_program.id}"
    get_response = client.get(url, headers=auth_header(coach))
    patch_response = client.patch(url, json={"name": "Taken"}, headers=auth_header(coach))

    assert [program["name"] for program in listed] == ["Mine"]
    assert get_response.status_code == 404
    assert get_response.json()["error"]["code"] == "PROGRAM_NOT_FOUND"
    assert patch_response.status_code == 404


def test_parent_cant_use_the_program_routes(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    assert client.get(PROGRAMS_URL, headers=auth_header(parent)).status_code == 403
    response = client.post(PROGRAMS_URL, json=new_program(db_session), headers=auth_header(parent))
    assert response.status_code == 403
