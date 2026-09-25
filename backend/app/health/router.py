"""Health endpoints used by Docker Compose, CI and any future deployment health checks."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import ErrorResponse, ServiceUnavailableError
from app.db.session import get_db

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


class DatabaseHealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["ok"]


@router.get("", response_model=HealthResponse, summary="Application liveness")
def get_health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/db",
    response_model=DatabaseHealthResponse,
    responses={503: {"model": ErrorResponse, "description": "Database unavailable"}},
    summary="Database connectivity",
)
def get_database_health(db: Annotated[Session, Depends(get_db)]) -> DatabaseHealthResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise ServiceUnavailableError("Database is unavailable") from exc
    return DatabaseHealthResponse(status="ok", database="ok")
