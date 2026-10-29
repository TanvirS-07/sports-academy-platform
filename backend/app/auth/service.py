from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.google import GoogleIdentity, GoogleLoginError
from app.auth.schemas import LoginRequest, RegisterRequest
from app.core.errors import ConflictError, UnauthorizedError
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

    if user is None or user.password_hash is None:
        # Still run a hash check so unknown emails (and Google-only accounts) take as
        # long as wrong passwords.
        verify_password(data.password, dummy_password_hash())
        raise UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, code="INVALID_CREDENTIALS")

    if not verify_password(data.password, user.password_hash) or not user.is_active:
        raise UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, code="INVALID_CREDENTIALS")

    return user


# Names are limited to 100 characters, like on the register form.
MAX_NAME_LENGTH = 100


def _names_from(identity: GoogleIdentity) -> tuple[str, str]:
    # Some Google accounts have no last name, or no name at all.
    first = identity.given_name or identity.email.split("@")[0]
    return first[:MAX_NAME_LENGTH], identity.family_name[:MAX_NAME_LENGTH] or "-"


def sign_in_with_google(db: Session, identity: GoogleIdentity) -> User:
    """The parent for a Google account: an account it signed in to before, an existing
    account with the same verified email (which is then linked), or a new parent.

    Coaches can't use Google. Their accounts are made by the academy and keep using
    their password, so a coach's Google account can't be used to take one over.
    """
    if not identity.email_verified:
        raise GoogleLoginError("unverified_email")

    user = db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        user = get_user_by_email(db, identity.email)
        if user is not None and user.google_sub is not None:
            # The email belongs to an account that's linked to a different Google account.
            raise GoogleLoginError("linked_elsewhere")

    if user is None:
        first_name, last_name = _names_from(identity)
        try:
            return create_user(
                db,
                email=identity.email,
                password=None,
                first_name=first_name,
                last_name=last_name,
                role=Role.PARENT,
                google_sub=identity.sub,
            )
        except ConflictError as exc:
            # Someone registered this email at the same moment.
            raise GoogleLoginError("failed") from exc

    if user.role != Role.PARENT:
        raise GoogleLoginError("coach_account")
    if not user.is_active:
        raise GoogleLoginError("inactive")

    if user.google_sub is None:
        user.google_sub = identity.sub
        db.commit()
    return user
