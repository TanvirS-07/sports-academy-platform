import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.attendance import service
from app.attendance.schemas import (
    AttendanceUpdate,
    PlayerAttendanceResponse,
    SessionAttendanceRow,
)
from app.auth.dependencies import require_role
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.sessions.service import get_session_for_coach
from app.users.models import Role, User

router = APIRouter(tags=["attendance"])

Coach = Annotated[User, Depends(require_role(Role.COACH))]
CoachOrParent = Annotated[User, Depends(require_role(Role.COACH, Role.PARENT))]
Db = Annotated[Session, Depends(get_db)]
SESSION_NOT_FOUND = {404: {"model": ErrorResponse, "description": "Session not found"}}


@router.get(
    "/sessions/{session_id}/attendance",
    response_model=list[SessionAttendanceRow],
    responses=SESSION_NOT_FOUND,
    summary="Attendance for a session's booked players (the session's coach)",
)
def get_session_attendance(
    session_id: uuid.UUID, coach: Coach, db: Db
) -> list[SessionAttendanceRow]:
    session = get_session_for_coach(db, coach, session_id)
    return service.list_session_attendance(db, session)


@router.put(
    "/sessions/{session_id}/attendance",
    response_model=list[SessionAttendanceRow],
    responses={
        **SESSION_NOT_FOUND,
        409: {"model": ErrorResponse, "description": "Session cancelled or not started yet"},
        422: {"model": ErrorResponse, "description": "A player isn't booked into the session"},
    },
    summary="Record attendance for a session",
)
def save_session_attendance(
    session_id: uuid.UUID, data: AttendanceUpdate, coach: Coach, db: Db
) -> list[SessionAttendanceRow]:
    session = get_session_for_coach(db, coach, session_id)
    return service.save_session_attendance(db, coach, session, data)


@router.get(
    "/players/{player_id}/attendance",
    response_model=PlayerAttendanceResponse,
    responses={404: {"model": ErrorResponse, "description": "Player not found"}},
    summary="A player's attendance (their parents, or their coaches for their own programs)",
)
def get_player_attendance(
    player_id: uuid.UUID, user: CoachOrParent, db: Db, program_id: uuid.UUID | None = None
) -> PlayerAttendanceResponse:
    return service.get_player_attendance(db, user, player_id, program_id)
