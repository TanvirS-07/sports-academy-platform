from sqlalchemy.orm import Session

from app.auth.schemas import LoginRequest, RegisterRequest
from app.core.errors import UnauthorizedError
from app.core.security import dummy_password_hash, verify_password
from app.users.models import Role, User
from app.users.service import create_user, get_user_by_email

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


def register_parent(db: Session, data: RegisterRequest) -> User:
    # Public registration only ever creates parents. Coaches come from scripts/create_coach.py.
    return create_user(
        db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
        role=Role.PARENT,
    )


def authenticate(db: Session, data: LoginRequest) -> User:
    user = get_user_by_email(db, data.email)

    if user is None:
        # Still run a hash check so unknown emails take as long as wrong passwords.
        verify_password(data.password, dummy_password_hash())
        raise UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, code="INVALID_CREDENTIALS")

    if not verify_password(data.password, user.password_hash) or not user.is_active:
        raise UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, code="INVALID_CREDENTIALS")

    return user
