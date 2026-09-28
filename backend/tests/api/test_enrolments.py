import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.helpers import auth_header, make_coach, make_player, make_program, make_user

PLAYERS_URL = "/api/v1/players"


def roster_url(program_id: uuid.UUID) -> str:
    return f"/api/v1/programs/{program_id}/players"


def test_coach_can_enrol_a_player(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    player = make_player(db_session, make_user(db_session))

    response = client.post(
        roster_url(program.id), json={"player_id": str(player.id)}, headers=auth_header(coach)
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ACTIVE"
    roster = client.get(roster_url(program.id), headers=auth_header(coach)).json()
    assert [(row["first_name"], row["date_of_birth"]) for row in roster] == [("Sam", "2013-05-14")]


def test_enrolling_twice_returns_409(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    player = make_player(db_session, make_user(db_session))
    body = {"player_id": str(player.id)}

    client.post(roster_url(program.id), json=body, headers=auth_header(coach))
    response = client.post(roster_url(program.id), json=body, headers=auth_header(coach))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ALREADY_ENROLLED"


def test_inactive_enrolment_hides_date_of_birth_and_can_be_reactivated(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    player = make_player(db_session, make_user(db_session))
    url = roster_url(program.id)
    client.post(url, json={"player_id": str(player.id)}, headers=auth_header(coach))

    response = client.patch(
        f"{url}/{player.id}", json={"status": "INACTIVE"}, headers=auth_header(coach)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "INACTIVE"
    assert response.json()["date_of_birth"] is None

    response = client.post(url, json={"player_id": str(player.id)}, headers=auth_header(coach))

    assert response.status_code == 201
    assert response.json()["status"] == "ACTIVE"
    assert len(client.get(url, headers=auth_header(coach)).json()) == 1


def test_unknown_player_cant_be_enrolled(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)

    response = client.post(
        roster_url(program.id), json={"player_id": str(uuid.uuid4())}, headers=auth_header(coach)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"


def test_changing_an_enrolment_that_doesnt_exist_returns_404(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    program = make_program(db_session, coach)
    player = make_player(db_session, make_user(db_session))

    response = client.patch(
        f"{roster_url(program.id)}/{player.id}",
        json={"status": "INACTIVE"},
        headers=auth_header(coach),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENROLMENT_NOT_FOUND"


def test_coach_cant_see_or_change_another_coachs_roster(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    other_program = make_program(db_session, make_coach(db_session, "other-coach@example.com"))
    player = make_player(db_session, make_user(db_session))
    url = roster_url(other_program.id)

    assert client.get(url, headers=auth_header(coach)).status_code == 404
    response = client.post(url, json={"player_id": str(player.id)}, headers=auth_header(coach))
    assert response.status_code == 404


def test_parent_cant_enrol_players(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)
    program = make_program(db_session, make_coach(db_session))
    player = make_player(db_session, parent)

    response = client.post(
        roster_url(program.id), json={"player_id": str(player.id)}, headers=auth_header(parent)
    )

    assert response.status_code == 403


def test_parent_sees_their_childs_active_programs(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    parent = make_user(db_session)
    player = make_player(db_session, parent)
    active = make_program(db_session, coach, name="U14 Development")
    left = make_program(db_session, coach, name="Summer Camp")
    for program in (active, left):
        client.post(
            roster_url(program.id), json={"player_id": str(player.id)}, headers=auth_header(coach)
        )
    client.patch(
        f"{roster_url(left.id)}/{player.id}",
        json={"status": "INACTIVE"},
        headers=auth_header(coach),
    )

    body = client.get(f"{PLAYERS_URL}/{player.id}", headers=auth_header(parent)).json()

    assert body["programs"] == [
        {
            "id": str(active.id),
            "name": "U14 Development",
            "sport": "Cricket",
            "age_group": "Under 14",
            "coach_name": "Chris Lee",
        }
    ]


def test_coach_search_shows_parent_first_names_but_not_date_of_birth(
    client: TestClient, db_session: Session
) -> None:
    coach = make_coach(db_session)
    alex = make_user(db_session, email="alex@example.com", first_name="Alex")
    priya = make_user(db_session, email="priya@example.com", first_name="Priya")
    make_player(db_session, alex, first_name="Sam", last_name="Lee")
    make_player(db_session, priya, first_name="Sam", last_name="Lee")
    make_player(db_session, priya, first_name="Jordan", last_name="Lee")

    response = client.post(
        f"{PLAYERS_URL}/search", json={"query": "sam lee"}, headers=auth_header(coach)
    )

    assert response.status_code == 200
    results = response.json()
    assert sorted(result["parent_first_names"][0] for result in results) == ["Alex", "Priya"]
    assert all("date_of_birth" not in result for result in results)


def test_search_treats_wildcards_as_plain_text(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)
    make_player(db_session, make_user(db_session))

    response = client.post(
        f"{PLAYERS_URL}/search", json={"query": "%%"}, headers=auth_header(coach)
    )

    assert response.json() == []


def test_search_is_for_coaches_only(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    response = client.post(
        f"{PLAYERS_URL}/search", json={"query": "sam"}, headers=auth_header(parent)
    )

    assert response.status_code == 403


def test_search_needs_at_least_two_characters(client: TestClient, db_session: Session) -> None:
    coach = make_coach(db_session)

    response = client.post(
        f"{PLAYERS_URL}/search", json={"query": " s "}, headers=auth_header(coach)
    )

    assert response.status_code == 422
