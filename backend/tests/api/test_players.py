from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import Role
from tests.helpers import auth_header, make_player, make_user

PLAYERS_URL = "/api/v1/players"

NEW_PLAYER = {"first_name": "Sam", "last_name": "Taylor", "date_of_birth": "2013-05-14"}


def test_parent_can_add_a_player(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    response = client.post(PLAYERS_URL, json=NEW_PLAYER, headers=auth_header(parent))

    assert response.status_code == 201
    body = response.json()
    assert body["first_name"] == "Sam"
    assert body["date_of_birth"] == "2013-05-14"

    listed = client.get(PLAYERS_URL, headers=auth_header(parent)).json()
    assert [player["id"] for player in listed] == [body["id"]]


def test_parent_only_sees_their_own_players(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session, email="parent@example.com")
    other_parent = make_user(db_session, email="other@example.com")
    make_player(db_session, parent, first_name="Sam")
    make_player(db_session, other_parent, first_name="Jordan")

    response = client.get(PLAYERS_URL, headers=auth_header(parent))

    assert [player["first_name"] for player in response.json()] == ["Sam"]


def test_parent_can_get_and_edit_their_player(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)
    player = make_player(db_session, parent)
    url = f"{PLAYERS_URL}/{player.id}"

    assert client.get(url, headers=auth_header(parent)).json()["first_name"] == "Sam"

    response = client.patch(url, json={"first_name": "Samuel"}, headers=auth_header(parent))

    assert response.status_code == 200
    assert response.json()["first_name"] == "Samuel"
    assert response.json()["last_name"] == "Taylor"


def test_another_parents_player_returns_404(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session, email="parent@example.com")
    other_parent = make_user(db_session, email="other@example.com")
    player = make_player(db_session, other_parent)
    url = f"{PLAYERS_URL}/{player.id}"

    get_response = client.get(url, headers=auth_header(parent))
    patch_response = client.patch(url, json={"first_name": "X"}, headers=auth_header(parent))

    assert get_response.status_code == 404
    assert get_response.json()["error"]["code"] == "PLAYER_NOT_FOUND"
    assert patch_response.status_code == 404


def test_unknown_player_returns_404(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    response = client.get(
        f"{PLAYERS_URL}/00000000-0000-0000-0000-000000000000", headers=auth_header(parent)
    )

    assert response.status_code == 404


def test_coach_cant_use_the_parent_player_routes(client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)

    assert client.get(PLAYERS_URL, headers=auth_header(coach)).status_code == 403
    assert client.post(PLAYERS_URL, json=NEW_PLAYER, headers=auth_header(coach)).status_code == 403


def test_date_of_birth_cant_be_in_the_future(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    response = client.post(
        PLAYERS_URL, json={**NEW_PLAYER, "date_of_birth": tomorrow}, headers=auth_header(parent)
    )

    assert response.status_code == 422


def test_blank_names_are_rejected(client: TestClient, db_session: Session) -> None:
    parent = make_user(db_session)

    response = client.post(
        PLAYERS_URL, json={**NEW_PLAYER, "first_name": "   "}, headers=auth_header(parent)
    )

    assert response.status_code == 422


def test_players_need_a_login(client: TestClient) -> None:
    assert client.get(PLAYERS_URL).status_code == 401
