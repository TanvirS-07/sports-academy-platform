import base64
import hashlib
import urllib.parse
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.auth import google
from app.core.config import get_settings

CLIENT_ID = "client-id.apps.googleusercontent.com"
REDIRECT_URI = "http://localhost:5173/api/v1/auth/google/callback"
NOW = datetime(2026, 10, 29, 9, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _google_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", REDIRECT_URI)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def id_token(**overrides: object) -> str:
    """An ID token shaped like Google's. Signature checks are skipped, so any key works."""
    claims: dict[str, object] = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "google-account-1",
        "email": "Sam.Parent@gmail.com",
        "email_verified": True,
        "given_name": "Sam",
        "family_name": "Parent",
        "nonce": "the-nonce",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(hours=1)).timestamp()),
    }
    claims.update(overrides)
    claims = {key: value for key, value in claims.items() if value is not None}
    return jwt.encode(claims, "not-googles-key-but-long-enough-for-hs256", algorithm="HS256")


# --- Starting a login ---


def test_authorization_url_asks_google_for_a_code_with_pkce() -> None:
    attempt = google.new_attempt()

    url = urllib.parse.urlparse(google.authorization_url(attempt))
    params = dict(urllib.parse.parse_qsl(url.query))

    assert f"{url.scheme}://{url.netloc}{url.path}" == google.AUTHORIZATION_URL
    assert params["client_id"] == CLIENT_ID
    assert params["redirect_uri"] == REDIRECT_URI
    assert params["response_type"] == "code"
    assert params["scope"] == "openid email profile"
    assert params["state"] == attempt.state
    assert params["nonce"] == attempt.nonce
    assert params["code_challenge_method"] == "S256"
    expected = base64.urlsafe_b64encode(hashlib.sha256(attempt.code_verifier.encode()).digest())
    assert params["code_challenge"] == expected.rstrip(b"=").decode()
    assert "code_verifier" not in params


def test_each_attempt_is_random() -> None:
    first, second = google.new_attempt(), google.new_attempt()

    assert first.state != second.state
    assert first.nonce != second.nonce
    assert first.code_verifier != second.code_verifier


def test_attempt_survives_the_round_trip_through_a_cookie() -> None:
    attempt = google.new_attempt()

    assert google.decode_attempt(google.encode_attempt(attempt)) == attempt


def test_an_old_attempt_is_refused() -> None:
    token = google.encode_attempt(google.new_attempt(), now=datetime.now(UTC) - timedelta(hours=1))

    with pytest.raises(google.GoogleLoginError) as exc:
        google.decode_attempt(token)
    assert exc.value.reason == "expired"


def test_an_attempt_signed_with_another_key_is_refused() -> None:
    claims = {"type": "google_login", "state": "s", "nonce": "n", "code_verifier": "v"}
    token = jwt.encode(
        {**claims, "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "some-other-secret-that-is-long-enough",
        algorithm="HS256",
    )

    with pytest.raises(google.GoogleLoginError):
        google.decode_attempt(token)


def test_an_access_token_is_not_accepted_as_an_attempt() -> None:
    claims = {"type": "access", "state": "s", "nonce": "n", "code_verifier": "v"}
    token = jwt.encode(
        {**claims, "exp": datetime.now(UTC) + timedelta(minutes=5)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(google.GoogleLoginError):
        google.decode_attempt(token)


def test_check_state_refuses_a_different_state() -> None:
    attempt = google.new_attempt()

    google.check_state(attempt, attempt.state)
    with pytest.raises(google.GoogleLoginError):
        google.check_state(attempt, "someone-elses-state")


# --- Reading the ID token ---


def test_identity_comes_from_the_id_token() -> None:
    identity = google.identity_from_id_token(id_token(), "the-nonce", now=NOW)

    assert identity == google.GoogleIdentity(
        sub="google-account-1",
        email="sam.parent@gmail.com",
        email_verified=True,
        given_name="Sam",
        family_name="Parent",
    )


def test_the_issuer_without_https_is_also_google() -> None:
    identity = google.identity_from_id_token(id_token(iss="accounts.google.com"), "the-nonce", NOW)

    assert identity.sub == "google-account-1"


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "https://evil.example.com"},
        {"aud": "another-apps-client-id"},
        {"exp": int((NOW - timedelta(seconds=1)).timestamp())},
        {"nonce": "a-different-nonce"},
        {"nonce": None},
        {"sub": None},
        {"email": None},
    ],
    ids=["issuer", "audience", "expired", "nonce", "no-nonce", "no-sub", "no-email"],
)
def test_bad_id_tokens_are_refused(overrides: dict[str, object]) -> None:
    with pytest.raises(google.GoogleLoginError):
        google.identity_from_id_token(id_token(**overrides), "the-nonce", now=NOW)


def test_garbage_is_not_an_id_token() -> None:
    with pytest.raises(google.GoogleLoginError):
        google.identity_from_id_token("not-a-jwt", "the-nonce", now=NOW)


def test_email_verified_must_be_exactly_true() -> None:
    identity = google.identity_from_id_token(id_token(email_verified="true"), "the-nonce", NOW)

    assert identity.email_verified is False


def test_fetch_identity_sends_the_code_verifier(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[tuple[str, str]] = []

    def fake_exchange(code: str, code_verifier: str) -> dict[str, object]:
        sent.append((code, code_verifier))
        return {"id_token": id_token(nonce=attempt.nonce, exp=2_000_000_000)}

    monkeypatch.setattr(google, "exchange_code", fake_exchange)
    attempt = google.new_attempt()

    identity = google.fetch_identity("the-code", attempt)

    assert sent == [("the-code", attempt.code_verifier)]
    assert identity.email == "sam.parent@gmail.com"


def test_fetch_identity_needs_an_id_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(google, "exchange_code", lambda code, verifier: {"access_token": "x"})

    with pytest.raises(google.GoogleLoginError):
        google.fetch_identity("the-code", google.new_attempt())
