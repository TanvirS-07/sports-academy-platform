import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    JWT_ALGORITHM,
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_argon2_and_verifies() -> None:
    password_hash = hash_password("correct horse battery")

    assert password_hash.startswith("$argon2id$")
    assert verify_password("correct horse battery", password_hash)
    assert not verify_password("wrong password", password_hash)


def test_same_password_gets_a_different_hash_each_time() -> None:
    assert hash_password("same password") != hash_password("same password")


def test_access_token_round_trip() -> None:
    user_id = uuid.uuid4()

    access_token = create_access_token(user_id, "PARENT")
    claims = decode_access_token(access_token.token)

    assert claims.user_id == user_id
    assert claims.role == "PARENT"
    assert access_token.expires_in == get_settings().access_token_expire_minutes * 60


def test_expired_token_is_rejected() -> None:
    issued_long_ago = datetime.now(UTC) - timedelta(days=1)
    access_token = create_access_token(uuid.uuid4(), "PARENT", now=issued_long_ago)

    with pytest.raises(InvalidTokenError):
        decode_access_token(access_token.token)


def test_tampered_token_is_rejected() -> None:
    token = create_access_token(uuid.uuid4(), "PARENT").token
    header, payload, signature = token.split(".")
    tampered = f"{header}.{payload}.{signature[:-2]}xx"

    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered)


def test_token_signed_with_another_secret_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "COACH",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        "some-other-secret-that-is-also-long-enough",
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_non_access_token_type_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "COACH",
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        get_settings().jwt_secret,
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_token_without_a_valid_user_id_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "not-a-uuid",
            "role": "COACH",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        get_settings().jwt_secret,
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_unsigned_token_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "COACH",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        key=None,
        algorithm="none",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)
