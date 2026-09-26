"""FastAPI dependencies for the logged-in user and role checks."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.users.models import Role, User

# auto_error=False so a missing header goes through our own error format.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise UnauthorizedError("Not authenticated", code="NOT_AUTHENTICATED")

    try:
        claims = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN") from exc

    # Load the user on every request so a deactivated account stops working straight
    # away, and so the role comes from the database rather than the token.
    user = db.get(User, claims.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: Role) -> Callable[[User], User]:
    """Dependency that only lets users with one of the given roles through.

    Usage: `coach: Annotated[User, Depends(require_role(Role.COACH))]`
    """

    def check_role(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ForbiddenError("You don't have permission to do this")
        return user

    return check_role
