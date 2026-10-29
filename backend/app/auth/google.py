"""Talking to Google for "Sign in with Google" (OpenID Connect, authorization code flow).

1. /auth/google/start makes a random state, nonce and PKCE code verifier, keeps them in
   a short-lived signed cookie, and sends the browser to Google.
2. Google sends the browser back to /auth/google/callback with a code and the state.
3. The callback checks the state against the cookie, swaps the code for an ID token
   (sending the client secret and code verifier), and checks the ID token's claims.

The ID token comes straight from Google's token endpoint over HTTPS, so its signature
doesn't need checking as well (OpenID Connect Core 3.1.3.7, and Google's own docs say
the same). Its issuer, audience, expiry and nonce are still checked.
"""

import base64
import hashlib
import hmac
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings
from app.core.security import JWT_ALGORITHM

AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUERS = frozenset({"https://accounts.google.com", "accounts.google.com"})
SCOPES = "openid email profile"

# How long someone has to pick their Google account before they need to start again.
ATTEMPT_LIFETIME = timedelta(minutes=10)
ATTEMPT_TOKEN_TYPE = "google_login"
TOKEN_REQUEST_TIMEOUT_SECONDS = 10


class GoogleLoginError(Exception):
    """Signing in with Google didn't work. `reason` is shown to the frontend as a code."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class LoginAttempt:
    state: str
    nonce: str
    code_verifier: str


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    given_name: str
    family_name: str


def new_attempt() -> LoginAttempt:
    return LoginAttempt(
        state=secrets.token_urlsafe(32),
        nonce=secrets.token_urlsafe(32),
        code_verifier=secrets.token_urlsafe(64),
    )


def _code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def authorization_url(attempt: LoginAttempt) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": attempt.state,
        "nonce": attempt.nonce,
        "code_challenge": _code_challenge(attempt.code_verifier),
        "code_challenge_method": "S256",
        # Let people who are signed in to more than one Google account pick which one.
        "prompt": "select_account",
    }
    return f"{AUTHORIZATION_URL}?{urllib.parse.urlencode(params)}"


def encode_attempt(attempt: LoginAttempt, now: datetime | None = None) -> str:
    """Signs the attempt so it can be kept in a cookie without the database."""
    issued_at = now or datetime.now(UTC)
    claims = {
        "type": ATTEMPT_TOKEN_TYPE,
        "state": attempt.state,
        "nonce": attempt.nonce,
        "code_verifier": attempt.code_verifier,
        "iat": issued_at,
        "exp": issued_at + ATTEMPT_LIFETIME,
    }
    return jwt.encode(claims, get_settings().jwt_secret, algorithm=JWT_ALGORITHM)


def decode_attempt(token: str) -> LoginAttempt:
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["type", "state", "nonce", "code_verifier", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise GoogleLoginError("expired") from exc

    if claims["type"] != ATTEMPT_TOKEN_TYPE:
        raise GoogleLoginError("failed")
    return LoginAttempt(
        state=claims["state"], nonce=claims["nonce"], code_verifier=claims["code_verifier"]
    )


def check_state(attempt: LoginAttempt, state: str) -> None:
    # A different state means the callback didn't come from the login this browser started.
    if not hmac.compare_digest(attempt.state.encode(), state.encode()):
        raise GoogleLoginError("failed")


def exchange_code(code: str, code_verifier: str) -> dict[str, object]:
    """Swaps the authorization code for Google's tokens."""
    settings = get_settings()
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        }
    ).encode()
    request = urllib.request.Request(
        TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TOKEN_REQUEST_TIMEOUT_SECONDS) as response:
            tokens = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        # URLError covers HTTP errors too, for example a code that was already used.
        raise GoogleLoginError("failed") from exc

    if not isinstance(tokens, dict):
        raise GoogleLoginError("failed")
    return tokens


def _text(claims: dict[str, object], key: str) -> str:
    value = claims.get(key)
    return value.strip() if isinstance(value, str) else ""


def identity_from_id_token(
    id_token: str, nonce: str, now: datetime | None = None
) -> GoogleIdentity:
    try:
        claims = jwt.decode(id_token, options={"verify_signature": False})
    except jwt.PyJWTError as exc:
        raise GoogleLoginError("failed") from exc

    now = now or datetime.now(UTC)
    exp = claims.get("exp")
    token_nonce = claims.get("nonce")
    if (
        claims.get("iss") not in ISSUERS
        or claims.get("aud") != get_settings().google_client_id
        or not isinstance(exp, int | float)
        or exp <= now.timestamp()
        or not isinstance(token_nonce, str)
        or not hmac.compare_digest(token_nonce.encode(), nonce.encode())
        or not _text(claims, "sub")
        or not _text(claims, "email")
    ):
        raise GoogleLoginError("failed")

    return GoogleIdentity(
        sub=_text(claims, "sub"),
        email=_text(claims, "email").lower(),
        email_verified=claims.get("email_verified") is True,
        given_name=_text(claims, "given_name"),
        family_name=_text(claims, "family_name"),
    )


def fetch_identity(code: str, attempt: LoginAttempt) -> GoogleIdentity:
    tokens = exchange_code(code, attempt.code_verifier)
    id_token = tokens.get("id_token")
    if not isinstance(id_token, str):
        raise GoogleLoginError("failed")
    return identity_from_id_token(id_token, attempt.nonce)
