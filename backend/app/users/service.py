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
    password: str,
    first_name: str,
    last_name: str,
    role: Role,
) -> User:
    user = User(
        email=email.strip().lower(),
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=role,
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
