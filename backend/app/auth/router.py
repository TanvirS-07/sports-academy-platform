from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import google, service
from app.auth.cookies import (
    GOOGLE_LOGIN_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    clear_google_login_cookie,
    clear_refresh_cookie,
    set_google_login_cookie,
    set_refresh_cookie,
)
from app.auth.rate_limit import ip_login_rate_limiter, login_rate_limiter
from app.auth.refresh_tokens import (
    INVALID_REFRESH_TOKEN_MESSAGE,
    issue_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.auth.schemas import LoginOptionsResponse, LoginRequest, RegisterRequest, TokenResponse
from app.core.config import get_settings
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
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    if login_rate_limiter.is_blocked(data.email) or ip_login_rate_limiter.is_blocked(ip):
        raise TooManyRequestsError(
            "Too many failed login attempts. Try again in a minute.",
            code="TOO_MANY_LOGIN_ATTEMPTS",
        )

    try:
        user = service.authenticate(db, data)
    except AppError:
        login_rate_limiter.record_failure(data.email)
        ip_login_rate_limiter.record_failure(ip)
        raise

    # Only the email count is reset. Otherwise logging in to your own account
    # would clear the count for an address that's guessing other people's.
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


# --- Sign in with Google (parents only) ---

# Frontend pages the Google routes send the browser to. The frontend and the API are
# served from one site (Vite's proxy locally, vercel.json on the demo), so these are paths.
GOOGLE_SUCCESS_PATH = "/parent"
GOOGLE_FAILURE_PATH = "/login"


@router.get(
    "/options",
    response_model=LoginOptionsResponse,
    summary="Which ways of logging in are turned on",
)
def login_options() -> LoginOptionsResponse:
    return LoginOptionsResponse(google=get_settings().google_login_enabled)


def _google_failure(reason: str) -> RedirectResponse:
    response = RedirectResponse(
        f"{GOOGLE_FAILURE_PATH}?google_error={reason}", status_code=status.HTTP_303_SEE_OTHER
    )
    clear_google_login_cookie(response)
    return response


@router.get(
    "/google/start",
    response_class=RedirectResponse,
    status_code=status.HTTP_303_SEE_OTHER,
    summary="Send the browser to Google to sign in",
)
def google_start() -> RedirectResponse:
    if not get_settings().google_login_enabled:
        return _google_failure("not_configured")

    attempt = google.new_attempt()
    response = RedirectResponse(
        google.authorization_url(attempt), status_code=status.HTTP_303_SEE_OTHER
    )
    set_google_login_cookie(
        response,
        google.encode_attempt(attempt),
        max_age=int(google.ATTEMPT_LIFETIME.total_seconds()),
    )
    return response


@router.get(
    "/google/callback",
    response_class=RedirectResponse,
    status_code=status.HTTP_303_SEE_OTHER,
    summary="Where Google sends the browser back to. Logs the parent in.",
)
def google_callback(
    db: Annotated[Session, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    login_cookie: Annotated[str | None, Cookie(alias=GOOGLE_LOGIN_COOKIE_NAME)] = None,
) -> RedirectResponse:
    try:
        if not get_settings().google_login_enabled:
            raise google.GoogleLoginError("not_configured")
        if error is not None:
            # access_denied means the person pressed Cancel on Google's page.
            raise google.GoogleLoginError("cancelled" if error == "access_denied" else "failed")
        if login_cookie is None:
            raise google.GoogleLoginError("expired")
        if code is None or state is None:
            raise google.GoogleLoginError("failed")

        attempt = google.decode_attempt(login_cookie)
        google.check_state(attempt, state)
        identity = google.fetch_identity(code, attempt)
        user = service.sign_in_with_google(db, identity)
    except google.GoogleLoginError as exc:
        return _google_failure(exc.reason)

    # Same as a password login: the refresh cookie is set here, and the frontend swaps
    # it for an access token when the page loads.
    response = RedirectResponse(GOOGLE_SUCCESS_PATH, status_code=status.HTTP_303_SEE_OTHER)
    clear_google_login_cookie(response)
    set_refresh_cookie(response, issue_refresh_token(db, user))
    return response
