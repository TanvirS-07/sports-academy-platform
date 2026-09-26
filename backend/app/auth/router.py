from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.rate_limit import login_rate_limiter
from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.core.errors import AppError, ErrorResponse, TooManyRequestsError
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
def login(data: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
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
    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token.token, expires_in=access_token.expires_in)
