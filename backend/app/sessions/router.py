import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.sessions import service
from app.sessions.schemas import SessionCreate, SessionResponse, SessionUpdate
from app.users.models import Role, User

router = APIRouter(prefix="/sessions", tags=["sessions"])

Coach = Annotated[User, Depends(require_role(Role.COACH))]
CoachOrParent = Annotated[User, Depends(require_role(Role.COACH, Role.PARENT))]
Db = Annotated[Session, Depends(get_db)]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Session not found"}}
NOT_EDITABLE = {
    409: {"model": ErrorResponse, "description": "Session cancelled or already started"}
}


@router.get(
    "",
    response_model=list[SessionResponse],
    summary="Sessions: a coach's own, or upcoming ones for a parent's children",
)
def list_sessions(
    user: CoachOrParent,
    db: Db,
    program_id: uuid.UUID | None = None,
    include_past: bool = False,
) -> list[SessionResponse]:
    sessions = service.list_sessions(db, user, program_id, include_past)
    return [SessionResponse.from_session(session) for session in sessions]


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse, "description": "Invalid times or unknown program"}},
    summary="Create a session",
)
def create_session(data: SessionCreate, coach: Coach, db: Db) -> SessionResponse:
    session = service.create_session(db, coach, data)
    return SessionResponse.from_session(session)


@router.get(
    "/{session_id}", response_model=SessionResponse, responses=NOT_FOUND, summary="One session"
)
def get_session(session_id: uuid.UUID, user: CoachOrParent, db: Db) -> SessionResponse:
    session = service.get_session_for_user(db, user, session_id)
    return SessionResponse.from_session(session)


@router.patch(
    "/{session_id}",
    response_model=SessionResponse,
    responses={
        **NOT_FOUND,
        409: {
            "model": ErrorResponse,
            "description": "Session cancelled or started, or capacity below the booked count",
        },
        422: {"model": ErrorResponse, "description": "Invalid times"},
    },
    summary="Edit a session",
)
def update_session(
    session_id: uuid.UUID, data: SessionUpdate, coach: Coach, db: Db
) -> SessionResponse:
    session = service.get_session_for_coach(db, coach, session_id)
    session = service.update_session(db, session, data)
    return SessionResponse.from_session(session)


@router.post(
    "/{session_id}/cancel",
    response_model=SessionResponse,
    responses={**NOT_FOUND, **NOT_EDITABLE},
    summary="Cancel a session",
)
def cancel_session(session_id: uuid.UUID, coach: Coach, db: Db) -> SessionResponse:
    session = service.get_session_for_coach(db, coach, session_id)
    session = service.cancel_session(db, session)
    return SessionResponse.from_session(session)
