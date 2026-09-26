from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.users.models import Role, User
from tests.helpers import DEFAULT_PASSWORD, make_user

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"


def _registration(**overrides: str) -> dict[str, str]:
    data = {
        "email": "sam.parent@example.com",
        "password": "a-good-long-password",
        "first_name": "Sam",
        "last_name": "Parent",
    }
    data.update(overrides)
    return data


# --- Registration ---


def test_register_creates_a_parent(client: TestClient, db_session: Session) -> None:
    response = client.post(REGISTER_URL, json=_registration())

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "sam.parent@example.com"
    assert body["role"] == "PARENT"
    assert "password" not in body
    assert "password_hash" not in body

    user = db_session.get(User, body["id"])
    assert user is not None
    assert user.role == Role.PARENT
    assert user.password_hash != "a-good-long-password"


def test_register_stores_email_in_lowercase(client: TestClient) -> None:
    response = client.post(REGISTER_URL, json=_registration(email="Sam.Parent@Example.COM"))

    assert response.status_code == 201
    assert response.json()["email"] == "sam.parent@example.com"


def test_register_rejects_a_duplicate_email(client: TestClient) -> None:
    client.post(REGISTER_URL, json=_registration())

    response = client.post(REGISTER_URL, json=_registration(email="SAM.PARENT@example.com"))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_register_does_not_accept_a_role(client: TestClient) -> None:
    data = {**_registration(), "role": "COACH"}

    response = client.post(REGISTER_URL, json=data)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_register_rejects_a_short_password(client: TestClient) -> None:
    response = client.post(REGISTER_URL, json=_registration(password="short"))

    assert response.status_code == 422


def test_register_rejects_an_invalid_email(client: TestClient) -> None:
    response = client.post(REGISTER_URL, json=_registration(email="not-an-email"))

    assert response.status_code == 422


def test_register_rejects_blank_names(client: TestClient) -> None:
    response = client.post(REGISTER_URL, json=_registration(first_name="   "))

    assert response.status_code == 422


# --- Login ---


def test_login_returns_an_access_token(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session, email="parent@example.com")

    response = client.post(
        LOGIN_URL, json={"email": "parent@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    claims = decode_access_token(body["access_token"])
    assert claims.user_id == user.id
    assert claims.role == "PARENT"


def test_login_email_is_case_insensitive(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="parent@example.com")

    response = client.post(
        LOGIN_URL, json={"email": "PARENT@Example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_response(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session, email="parent@example.com")

    wrong_password = client.post(
        LOGIN_URL, json={"email": "parent@example.com", "password": "wrong-password"}
    )
    unknown_email = client.post(
        LOGIN_URL, json={"email": "nobody@example.com", "password": "wrong-password"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_inactive_user_cannot_log_in(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="parent@example.com", is_active=False)

    response = client.post(
        LOGIN_URL, json={"email": "parent@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_coach_can_log_in(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="coach@example.com", role=Role.COACH)

    response = client.post(
        LOGIN_URL, json={"email": "coach@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    assert decode_access_token(response.json()["access_token"]).role == "COACH"
