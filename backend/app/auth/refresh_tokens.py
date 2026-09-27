"""Issuing, rotating and revoking refresh tokens.

A refresh token is a random string (not a JWT). The browser keeps it in an httpOnly
cookie and the database only keeps its SHA-256 hash.

Every refresh swaps the token for a new one (rotation). The old token is revoked, and
if it's ever sent again we assume it was stolen and revoke every token from that login.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken
from app.core.config import get_settings
from app.core.errors import UnauthorizedError
from app.users.models import User

INVALID_REFRESH_TOKEN_MESSAGE = "Your session has expired. Please log in again."


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _invalid() -> UnauthorizedError:
    return UnauthorizedError(INVALID_REFRESH_TOKEN_MESSAGE, code="INVALID_REFRESH_TOKEN")


def _add_token(db: Session, user_id: uuid.UUID, family_id: uuid.UUID, now: datetime) -> str:
    token = secrets.token_urlsafe(32)
    lifetime = timedelta(days=get_settings().refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash(token),
            family_id=family_id,
            expires_at=now + lifetime,
        )
    )
    return token


def issue_refresh_token(db: Session, user: User, now: datetime | None = None) -> str:
    """Start a new token family for a fresh login and return the raw token."""
    token = _add_token(db, user.id, uuid.uuid4(), now or datetime.now(UTC))
    db.commit()
    return token


def rotate_refresh_token(db: Session, token: str, now: datetime | None = None) -> tuple[User, str]:
    """Revoke the given token and return its user with a new token from the same family."""
    now = now or datetime.now(UTC)

    # Lock the row so two requests with the same token can't both rotate it.
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == _hash(token)).with_for_update()
    )
    if stored is None:
        raise _invalid()

    if stored.revoked_at is not None:
        # An old token came back. Either it was stolen or the user logged out and
        # something replayed it. Revoke the whole family so a thief can't keep going.
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == stored.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        db.commit()
        raise _invalid()

    if stored.expires_at <= now:
        raise _invalid()

    user = db.get(User, stored.user_id)
    stored.revoked_at = now
    if user is None or not user.is_active:
        db.commit()
        raise _invalid()

    new_token = _add_token(db, user.id, stored.family_id, now)
    db.commit()
    return user, new_token
