"""Small helpers for creating test data."""

from datetime import date

from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.players.models import Player
from app.players.schemas import PlayerCreate
from app.players.service import create_player
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


def make_player(
    db: Session,
    parent: User,
    *,
    first_name: str = "Sam",
    last_name: str = "Taylor",
    date_of_birth: date = date(2013, 5, 14),
) -> Player:
    return create_player(
        db,
        parent,
        PlayerCreate(first_name=first_name, last_name=last_name, date_of_birth=date_of_birth),
    )
