"""Password hashing and JWT access tokens."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"

_password_hash = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


@lru_cache
def dummy_password_hash() -> str:
    """A real Argon2 hash to check against when the email doesn't exist.

    Verifying against it takes the same time as a real check, so response times
    don't reveal whether an email is registered.
    """
    return hash_password("not-a-real-password")


class InvalidTokenError(Exception):
    """The token is missing, expired, tampered with or not an access token."""


@dataclass(frozen=True)
class AccessToken:
    token: str
    expires_in: int  # seconds


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    role: str


def create_access_token(user_id: uuid.UUID, role: str, now: datetime | None = None) -> AccessToken:
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    lifetime = timedelta(minutes=settings.access_token_expire_minutes)

    claims = {
        "sub": str(user_id),
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": issued_at,
        "exp": issued_at + lifetime,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(claims, settings.jwt_secret, algorithm=JWT_ALGORITHM)
    return AccessToken(token=token, expires_in=int(lifetime.total_seconds()))


def decode_access_token(token: str) -> AccessTokenClaims:
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "role", "type", "iat", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError from exc

    if claims["type"] != ACCESS_TOKEN_TYPE:
        raise InvalidTokenError

    try:
        user_id = uuid.UUID(claims["sub"])
    except ValueError as exc:
        raise InvalidTokenError from exc

    return AccessTokenClaims(user_id=user_id, role=claims["role"])
