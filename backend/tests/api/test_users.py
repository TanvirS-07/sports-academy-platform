import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from tests.helpers import auth_header, make_user

ME_URL = "/api/v1/users/me"


def test_me_returns_the_logged_in_user(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session, email="parent@example.com")

    response = client.get(ME_URL, headers=auth_header(user))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user.id)
    assert body["email"] == "parent@example.com"
    assert body["role"] == "PARENT"
    assert "password_hash" not in body


def test_me_without_a_token_returns_401(client: TestClient) -> None:
    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_me_with_a_malformed_token_returns_401(client: TestClient) -> None:
    response = client.get(ME_URL, headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_me_with_an_expired_token_returns_401(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    token = create_access_token(user.id, "PARENT", now=datetime.now(UTC) - timedelta(days=1))

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {token.token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_me_for_a_deleted_user_returns_401(client: TestClient) -> None:
    token = create_access_token(uuid.uuid4(), "PARENT")

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {token.token}"})

    assert response.status_code == 401


def test_me_for_a_deactivated_user_returns_401(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    headers = auth_header(user)
    user.is_active = False
    db_session.commit()

    response = client.get(ME_URL, headers=headers)

    assert response.status_code == 401


def test_me_uses_the_role_from_the_database_not_the_token(
    client: TestClient, db_session: Session
) -> None:
    user = make_user(db_session)  # a parent
    forged_role_token = create_access_token(user.id, "COACH")

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {forged_role_token.token}"})

    assert response.json()["role"] == "PARENT"
