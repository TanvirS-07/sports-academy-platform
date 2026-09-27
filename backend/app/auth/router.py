from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from app.auth.rate_limit import login_rate_limiter
from app.auth.refresh_tokens import (
    INVALID_REFRESH_TOKEN_MESSAGE,
    issue_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.core.errors import (
    AppError,
    ErrorResponse,
    TooManyRequestsError,
    UnauthorizedError,
    app_error_response,
)
from app.core.security import create_access_token
from app.db.session import get_db
from app.users.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse, "description": "Email already registered"}},
    summary="Register a parent account",
)
def register(data: RegisterRequest, db: Annotated[Session, Depends(get_db)]) -> UserResponse:
    user = service.register_parent(db, data)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid email or password"},
        429: {"model": ErrorResponse, "description": "Too many failed attempts"},
    },
    summary="Log in and get an access token",
)
def login(
    data: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    if login_rate_limiter.is_blocked(data.email):
        raise TooManyRequestsError(
            "Too many failed login attempts. Try again in a minute.",
            code="TOO_MANY_LOGIN_ATTEMPTS",
        )

    try:
        user = service.authenticate(db, data)
    except AppError:
        login_rate_limiter.record_failure(data.email)
        raise

    login_rate_limiter.reset(data.email)
    set_refresh_cookie(response, issue_refresh_token(db, user))
    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token.token, expires_in=access_token.expires_in)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse, "description": "Missing, expired or revoked"}},
    summary="Swap the refresh cookie for a new one and get a new access token",
)
def refresh(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> TokenResponse | Response:
    try:
        if refresh_token is None:
            raise UnauthorizedError(INVALID_REFRESH_TOKEN_MESSAGE, code="INVALID_REFRESH_TOKEN")
        user, new_refresh_token = rotate_refresh_token(db, refresh_token)
    except AppError as exc:
        # Clear the cookie so the browser stops sending a token that will never work.
        error = app_error_response(exc)
        clear_refresh_cookie(error)
        return error

    set_refresh_cookie(response, new_refresh_token)
    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token.token, expires_in=access_token.expires_in)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the refresh cookie and clear it",
)
def logout(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> None:
    # No access token is needed, so logging out still works after it has expired.
    if refresh_token is not None:
        revoke_refresh_token(db, refresh_token)
    clear_refresh_cookie(response)
