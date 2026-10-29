import urllib.parse
from collections.abc import Iterator
from http.cookies import SimpleCookie

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import google
from app.auth.cookies import GOOGLE_LOGIN_COOKIE_NAME, REFRESH_COOKIE_NAME
from app.core.config import get_settings
from app.users.models import Role, User
from tests.helpers import DEFAULT_PASSWORD, make_coach, make_user

OPTIONS_URL = "/api/v1/auth/options"
START_URL = "/api/v1/auth/google/start"
CALLBACK_URL = "/api/v1/auth/google/callback"
REFRESH_URL = "/api/v1/auth/refresh"
LOGIN_URL = "/api/v1/auth/login"


def _identity(**overrides: object) -> google.GoogleIdentity:
    values: dict[str, object] = {
        "sub": "google-account-1",
        "email": "sam.parent@gmail.com",
        "email_verified": True,
        "given_name": "Sam",
        "family_name": "Parent",
    }
    values.update(overrides)
    return google.GoogleIdentity(**values)  # type: ignore[arg-type]


@pytest.fixture
def google_enabled(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://testserver/api/v1/auth/google/callback")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def google_says(monkeypatch: pytest.MonkeyPatch) -> list[google.GoogleIdentity]:
    """Replaces the call to Google. Tests put the identity Google should return in the list."""
    identities: list[google.GoogleIdentity] = []

    def fake_fetch_identity(code: str, attempt: google.LoginAttempt) -> google.GoogleIdentity:
        assert code == "code-from-google"
        return identities[0]

    monkeypatch.setattr(google, "fetch_identity", fake_fetch_identity)
    return identities


def _cookies(response: httpx.Response) -> SimpleCookie:
    cookie = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        cookie.load(header)
    return cookie


def _start(client: TestClient) -> tuple[str, str]:
    """Starts a Google login. Returns the state Google would send back and the cookie."""
    response = client.get(START_URL, follow_redirects=False)
    assert response.status_code == 303
    query = urllib.parse.urlparse(response.headers["location"]).query
    return dict(urllib.parse.parse_qsl(query))["state"], _cookies(response)[
        GOOGLE_LOGIN_COOKIE_NAME
    ].value


def _callback(client: TestClient, cookie: str | None, **params: str) -> httpx.Response:
    # The cookies are Secure outside development and the test client uses plain http,
    # so the cookie jar won't send them. Send the login cookie by hand instead.
    client.cookies.clear()
    headers = {"Cookie": f"{GOOGLE_LOGIN_COOKIE_NAME}={cookie}"} if cookie else {}
    return client.get(CALLBACK_URL, params=params, headers=headers, follow_redirects=False)


def _sign_in(
    client: TestClient, google_says: list[google.GoogleIdentity], **identity: object
) -> httpx.Response:
    google_says.append(_identity(**identity))
    state, cookie = _start(client)
    return _callback(client, cookie, code="code-from-google", state=state)


def _logged_in(response: httpx.Response) -> bool:
    cookies = _cookies(response)
    return REFRESH_COOKIE_NAME in cookies and cookies[REFRESH_COOKIE_NAME].value != ""


def _error_in(response: httpx.Response) -> str | None:
    location = urllib.parse.urlparse(response.headers["location"])
    assert location.path == "/login"
    return dict(urllib.parse.parse_qsl(location.query)).get("google_error")


# --- Turned on or off ---


def test_options_say_google_is_off_without_settings(client: TestClient) -> None:
    assert client.get(OPTIONS_URL).json() == {"google": False}


@pytest.mark.usefixtures("google_enabled")
def test_options_say_google_is_on_with_settings(client: TestClient) -> None:
    assert client.get(OPTIONS_URL).json() == {"google": True}


def test_start_without_settings_goes_back_to_login(client: TestClient) -> None:
    response = client.get(START_URL, follow_redirects=False)

    assert response.status_code == 303
    assert _error_in(response) == "not_configured"


# --- Starting ---


@pytest.mark.usefixtures("google_enabled")
def test_start_sends_the_browser_to_google_with_a_cookie(client: TestClient) -> None:
    response = client.get(START_URL, follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"].startswith(google.AUTHORIZATION_URL + "?")
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{GOOGLE_LOGIN_COOKIE_NAME}=")
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth/google" in cookie
    assert "SameSite=lax" in cookie


# --- New and existing accounts ---


@pytest.mark.usefixtures("google_enabled")
def test_a_new_google_user_becomes_a_parent_and_is_logged_in(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    response = _sign_in(client, google_says)

    assert response.status_code == 303
    assert response.headers["location"] == "/parent"
    user = db_session.scalar(select(User).where(User.email == "sam.parent@gmail.com"))
    assert user is not None
    assert user.role == Role.PARENT
    assert user.google_sub == "google-account-1"
    assert user.password_hash is None
    assert (user.first_name, user.last_name) == ("Sam", "Parent")

    # The refresh cookie works like after a password login.
    refresh_token = _cookies(response)[REFRESH_COOKIE_NAME]
    assert refresh_token["httponly"]
    assert refresh_token["samesite"] == "strict"
    client.cookies.clear()
    refreshed = client.post(REFRESH_URL, headers={"Cookie": f"refresh_token={refresh_token.value}"})
    assert refreshed.status_code == 200
    me = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"}
    )
    assert me.json()["email"] == "sam.parent@gmail.com"


@pytest.mark.usefixtures("google_enabled")
def test_the_login_cookie_is_cleared_after_the_callback(
    client: TestClient, google_says: list[google.GoogleIdentity]
) -> None:
    response = _sign_in(client, google_says)

    login_cookie = _cookies(response)[GOOGLE_LOGIN_COOKIE_NAME]
    assert login_cookie.value == ""
    assert login_cookie["max-age"] == "0"


@pytest.mark.usefixtures("google_enabled")
def test_signing_in_again_uses_the_same_account(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    _sign_in(client, google_says)
    google_says.clear()
    # The Google account's email changed, but its id is the same.
    response = _sign_in(client, google_says, email="sam.new@gmail.com")

    assert response.headers["location"] == "/parent"
    users = db_session.scalars(select(User).where(User.google_sub == "google-account-1")).all()
    assert [user.email for user in users] == ["sam.parent@gmail.com"]


@pytest.mark.usefixtures("google_enabled")
def test_an_existing_parent_with_the_same_email_is_linked(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    parent = make_user(db_session, email="sam.parent@gmail.com")

    response = _sign_in(client, google_says)

    assert response.headers["location"] == "/parent"
    db_session.refresh(parent)
    assert parent.google_sub == "google-account-1"
    # Their password still works too.
    login = client.post(
        LOGIN_URL, json={"email": "sam.parent@gmail.com", "password": DEFAULT_PASSWORD}
    )
    assert login.status_code == 200


@pytest.mark.usefixtures("google_enabled")
def test_names_have_fallbacks_when_google_has_none(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    _sign_in(client, google_says, given_name="", family_name="")

    user = db_session.scalar(select(User).where(User.email == "sam.parent@gmail.com"))
    assert user is not None
    assert (user.first_name, user.last_name) == ("sam.parent", "-")


# --- Refused ---


@pytest.mark.usefixtures("google_enabled")
def test_a_coach_cannot_sign_in_with_google(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    coach = make_coach(db_session, email="coach@gmail.com")

    response = _sign_in(client, google_says, email="coach@gmail.com")

    assert _error_in(response) == "coach_account"
    assert not _logged_in(response)
    db_session.refresh(coach)
    assert coach.google_sub is None


@pytest.mark.usefixtures("google_enabled")
def test_an_unverified_email_is_refused(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    parent = make_user(db_session, email="sam.parent@gmail.com")

    response = _sign_in(client, google_says, email_verified=False)

    assert _error_in(response) == "unverified_email"
    db_session.refresh(parent)
    assert parent.google_sub is None


@pytest.mark.usefixtures("google_enabled")
def test_an_inactive_parent_is_refused(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    make_user(db_session, email="sam.parent@gmail.com", is_active=False)

    response = _sign_in(client, google_says)

    assert _error_in(response) == "inactive"
    assert not _logged_in(response)


@pytest.mark.usefixtures("google_enabled")
def test_an_account_linked_to_another_google_account_is_refused(
    client: TestClient, db_session: Session, google_says: list[google.GoogleIdentity]
) -> None:
    parent = make_user(db_session, email="sam.parent@gmail.com")
    parent.google_sub = "a-different-google-account"
    db_session.commit()

    response = _sign_in(client, google_says)

    assert _error_in(response) == "linked_elsewhere"


@pytest.mark.usefixtures("google_enabled")
def test_a_callback_with_the_wrong_state_is_refused(
    client: TestClient, google_says: list[google.GoogleIdentity]
) -> None:
    google_says.append(_identity())
    _, cookie = _start(client)

    response = _callback(client, cookie, code="code-from-google", state="not-the-state")

    assert _error_in(response) == "failed"
    assert not _logged_in(response)


@pytest.mark.usefixtures("google_enabled")
def test_a_callback_without_the_login_cookie_is_refused(
    client: TestClient, google_says: list[google.GoogleIdentity]
) -> None:
    google_says.append(_identity())
    state, _ = _start(client)

    response = _callback(client, None, code="code-from-google", state=state)

    assert _error_in(response) == "expired"


@pytest.mark.usefixtures("google_enabled")
def test_pressing_cancel_on_google_goes_back_to_login(client: TestClient) -> None:
    state, cookie = _start(client)

    response = _callback(client, cookie, error="access_denied", state=state)

    assert _error_in(response) == "cancelled"


@pytest.mark.usefixtures("google_enabled")
def test_a_failed_code_exchange_goes_back_to_login(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def google_is_down(code: str, verifier: str) -> dict[str, object]:
        raise google.GoogleLoginError("failed")

    monkeypatch.setattr(google, "exchange_code", google_is_down)
    state, cookie = _start(client)

    response = _callback(client, cookie, code="code-from-google", state=state)

    assert _error_in(response) == "failed"


def test_callback_without_settings_is_refused(client: TestClient) -> None:
    response = _callback(client, "x", code="code-from-google", state="x")

    assert _error_in(response) == "not_configured"
