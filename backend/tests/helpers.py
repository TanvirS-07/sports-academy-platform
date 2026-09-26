"""Small helpers for creating test data."""

from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.users.models import Role, User
from app.users.service import create_user

DEFAULT_PASSWORD = "correct-horse-battery"


def make_user(
    db: Session,
    *,
    email: str = "parent@example.com",
    password: str = DEFAULT_PASSWORD,
    role: Role = Role.PARENT,
    first_name: str = "Alex",
    last_name: str = "Taylor",
    is_active: bool = True,
) -> User:
    user = create_user(
        db, email=email, password=password, first_name=first_name, last_name=last_name, role=role
    )
    if not is_active:
        user.is_active = False
        db.commit()
    return user


def auth_header(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.role.value).token
    return {"Authorization": f"Bearer {token}"}
