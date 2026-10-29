"""The cookies that carry the refresh token and an unfinished Google sign-in."""

from fastapi import Response

from app.core.config import get_settings

REFRESH_COOKIE_NAME = "refresh_token"
# Only the auth endpoints need the cookie, so the browser doesn't send it anywhere else.
REFRESH_COOKIE_PATH = "/api/v1/auth"

GOOGLE_LOGIN_COOKIE_NAME = "google_login"
GOOGLE_LOGIN_COOKIE_PATH = "/api/v1/auth/google"


def _secure() -> bool:
    # Local development runs over plain http, so Secure is only turned off there.
    return get_settings().app_env != "development"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        max_age=get_settings().refresh_token_expire_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        secure=_secure(),
        httponly=True,
        samesite="strict",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        secure=_secure(),
        httponly=True,
        samesite="strict",
    )


def set_google_login_cookie(response: Response, token: str, max_age: int) -> None:
    # Lax, not Strict: Google sends the browser back to the callback from another site,
    # and the browser only includes a Strict cookie on requests that start on this site.
    response.set_cookie(
        GOOGLE_LOGIN_COOKIE_NAME,
        token,
        max_age=max_age,
        path=GOOGLE_LOGIN_COOKIE_PATH,
        secure=_secure(),
        httponly=True,
        samesite="lax",
    )


def clear_google_login_cookie(response: Response) -> None:
    response.delete_cookie(
        GOOGLE_LOGIN_COOKIE_NAME,
        path=GOOGLE_LOGIN_COOKIE_PATH,
        secure=_secure(),
        httponly=True,
        samesite="lax",
    )
