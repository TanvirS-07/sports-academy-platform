from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.core.security import hash_password
from app.users.models import Role, User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def create_user(
    db: Session,
    *,
    email: str,
    password: str | None,
    first_name: str,
    last_name: str,
    role: Role,
    google_sub: str | None = None,
) -> User:
    user = User(
        email=email.strip().lower(),
        # No password means the account can only sign in with Google.
        password_hash=hash_password(password) if password is not None else None,
        first_name=first_name,
        last_name=last_name,
        role=role,
        google_sub=google_sub,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # The unique constraint on email also covers two sign-ups racing each other.
        db.rollback()
        raise ConflictError(
            "An account with this email already exists", code="EMAIL_ALREADY_REGISTERED"
        ) from exc
    db.refresh(user)
    return user
