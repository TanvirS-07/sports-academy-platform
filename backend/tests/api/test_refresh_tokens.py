from datetime import UTC, datetime, timedelta
from http.cookies import SimpleCookie

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken
from app.core.config import get_settings
from app.core.security import decode_access_token
from app.users.models import User
from tests.helpers import DEFAULT_PASSWORD, make_user

LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"


def _cookie(response: httpx.Response) -> SimpleCookie:
    cookie = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        cookie.load(header)
    return cookie


def _refresh_token(response: httpx.Response) -> str:
    return _cookie(response)["refresh_token"].value


def _log_in(client: TestClient, email: str = "parent@example.com") -> str:
    response = client.post(LOGIN_URL, json={"email": email, "password": DEFAULT_PASSWORD})
    assert response.status_code == 200
    return _refresh_token(response)


def _refresh(client: TestClient, token: str) -> httpx.Response:
    # The cookie is Secure outside development and the test client uses plain http,
    # so the cookie jar won't send it. Send it by hand instead.
    client.cookies.clear()
    return client.post(REFRESH_URL, headers={"Cookie": f"refresh_token={token}"})


def _assert_cookie_cleared(response: httpx.Response) -> None:
    morsel = _cookie(response)["refresh_token"]
    assert morsel.value == ""
    assert morsel["max-age"] == "0"
    assert morsel["path"] == "/api/v1/auth"


# --- Login ---


def test_login_sets_the_refresh_cookie(client: TestClient, db_session: Session) -> None:
    make_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "parent@example.com", "password": DEFAULT_PASSWORD}
    )

    morsel = _cookie(response)["refresh_token"]
    assert morsel.value
    assert morsel["httponly"]
    assert morsel["secure"]
    assert morsel["samesite"] == "strict"
    assert morsel["path"] == "/api/v1/auth"
    assert morsel["max-age"] == str(7 * 24 * 60 * 60)


def test_refresh_cookie_is_not_secure_in_development(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "app_env", "development")
    make_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "parent@example.com", "password": DEFAULT_PASSWORD}
    )

    assert not _cookie(response)["refresh_token"]["secure"]


def test_only_a_hash_of_the_refresh_token_is_stored(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)

    token = _log_in(client)

    stored = db_session.scalars(select(RefreshToken)).one()
    assert stored.token_hash != token
    assert len(stored.token_hash) == 64


def test_failed_login_does_not_set_a_cookie(client: TestClient, db_session: Session) -> None:
    make_user(db_session)

    response = client.post(LOGIN_URL, json={"email": "parent@example.com", "password": "wrong"})

    assert response.status_code == 401
    assert "refresh_token" not in _cookie(response)


# --- Refresh ---


def test_refresh_returns_a_new_access_token_and_cookie(
    client: TestClient, db_session: Session
) -> None:
    user = make_user(db_session)
    token = _log_in(client)

    response = _refresh(client, token)

    assert response.status_code == 200
    assert decode_access_token(response.json()["access_token"]).user_id == user.id
    new_token = _refresh_token(response)
    assert new_token and new_token != token
    assert _cookie(response)["refresh_token"]["httponly"]


def test_refresh_revokes_the_old_token_and_keeps_the_family(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    _refresh(client, _log_in(client))

    old, new = db_session.scalars(select(RefreshToken).order_by(RefreshToken.created_at)).all()
    assert old.revoked_at is not None
    assert new.revoked_at is None
    assert old.family_id == new.family_id


def test_the_new_token_can_be_refreshed_again(client: TestClient, db_session: Session) -> None:
    make_user(db_session)
    first = _refresh(client, _log_in(client))

    second = _refresh(client, _refresh_token(first))

    assert second.status_code == 200


def test_refresh_without_a_cookie_fails(client: TestClient) -> None:
    response = client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"
    _assert_cookie_cleared(response)


def test_refresh_with_an_unknown_token_fails(client: TestClient) -> None:
    response = _refresh(client, "not-a-real-token")

    assert response.status_code == 401
    _assert_cookie_cleared(response)


def test_refresh_with_an_expired_token_fails(client: TestClient, db_session: Session) -> None:
    make_user(db_session)
    token = _log_in(client)
    stored = db_session.scalars(select(RefreshToken)).one()
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    response = _refresh(client, token)

    assert response.status_code == 401
    _assert_cookie_cleared(response)


def test_refresh_fails_for_an_inactive_user(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    token = _log_in(client)
    user.is_active = False
    db_session.commit()

    response = _refresh(client, token)

    assert response.status_code == 401
    _assert_cookie_cleared(response)
    assert db_session.scalars(select(RefreshToken)).one().revoked_at is not None


def test_reusing_an_old_token_revokes_the_whole_family(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    first = _log_in(client)
    second = _refresh_token(_refresh(client, first))

    reused = _refresh(client, first)

    assert reused.status_code == 401
    _assert_cookie_cleared(reused)
    # The token the real user was holding stops working too.
    assert _refresh(client, second).status_code == 401
    tokens = db_session.scalars(select(RefreshToken)).all()
    assert all(token.revoked_at is not None for token in tokens)


def test_reuse_only_revokes_that_login(client: TestClient, db_session: Session) -> None:
    make_user(db_session)
    phone = _log_in(client)
    laptop = _log_in(client)
    _refresh(client, phone)

    _refresh(client, phone)

    assert _refresh(client, laptop).status_code == 200


def test_deleting_a_user_deletes_their_tokens(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    _log_in(client)

    db_session.delete(db_session.get(User, user.id))
    db_session.commit()

    assert db_session.scalars(select(RefreshToken)).all() == []


# --- Logout ---


def _log_out(client: TestClient, token: str) -> httpx.Response:
    client.cookies.clear()
    return client.post(LOGOUT_URL, headers={"Cookie": f"refresh_token={token}"})


def test_logout_revokes_the_token_and_clears_the_cookie(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    token = _log_in(client)

    response = _log_out(client, token)

    assert response.status_code == 204
    _assert_cookie_cleared(response)
    assert db_session.scalars(select(RefreshToken)).one().revoked_at is not None
    assert _refresh(client, token).status_code == 401


def test_logout_without_a_cookie_still_succeeds(client: TestClient) -> None:
    response = client.post(LOGOUT_URL)

    assert response.status_code == 204
    _assert_cookie_cleared(response)


def test_logout_with_an_unknown_token_still_succeeds(client: TestClient) -> None:
    assert _log_out(client, "not-a-real-token").status_code == 204


def test_logout_only_affects_that_login(client: TestClient, db_session: Session) -> None:
    make_user(db_session)
    phone = _log_in(client)
    laptop = _log_in(client)

    _log_out(client, phone)

    assert _refresh(client, laptop).status_code == 200
