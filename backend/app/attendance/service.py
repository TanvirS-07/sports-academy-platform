"""Recording attendance, and showing it to coaches and parents.

Only players with a confirmed booking can be marked, and only once the session has
started. Bookings can't be cancelled after that, so the list of booked players doesn't
change while attendance is being recorded.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.attendance.models import Attendance, AttendanceStatus
from app.attendance.schemas import (
    AttendanceSummary,
    AttendanceUpdate,
    PlayerAttendanceRecord,
    PlayerAttendanceResponse,
    SessionAttendanceRow,
)
from app.bookings.schemas import BookingPlayer
from app.bookings.service import list_session_bookings
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.players.models import Player
from app.policies import can_view_player_records
from app.programs.models import Program
from app.sessions.models import SessionStatus, TrainingSession
from app.users.models import Role, User


def _now() -> datetime:
    return datetime.now(UTC)


def list_session_attendance(db: Session, session: TrainingSession) -> list[SessionAttendanceRow]:
    marked = {
        attendance.player_id: attendance.status
        for attendance in db.scalars(select(Attendance).where(Attendance.session_id == session.id))
    }
    return [
        SessionAttendanceRow(
            player=BookingPlayer.model_validate(booking.player),
            status=marked.get(booking.player_id),
        )
        for booking in list_session_bookings(db, session)
    ]


def save_session_attendance(
    db: Session, coach: User, session: TrainingSession, data: AttendanceUpdate
) -> list[SessionAttendanceRow]:
    if session.status == SessionStatus.CANCELLED:
        raise ConflictError("This session has been cancelled", code="SESSION_CANCELLED")
    if session.starts_at > _now():
        raise ConflictError("Attendance opens when the session starts", code="ATTENDANCE_NOT_OPEN")

    booked = {booking.player_id for booking in list_session_bookings(db, session)}
    if any(record.player_id not in booked for record in data.records):
        raise UnprocessableError(
            "Only players booked into this session can be marked", code="PLAYER_NOT_BOOKED"
        )

    for record in data.records:
        # Insert, or change the existing record if the player was already marked.
        db.execute(
            insert(Attendance)
            .values(
                id=uuid.uuid4(),
                session_id=session.id,
                player_id=record.player_id,
                status=record.status,
                recorded_by=coach.id,
            )
            .on_conflict_do_update(
                constraint="uq_attendance_session_id",
                set_={"status": record.status, "recorded_by": coach.id, "updated_at": func.now()},
            )
        )
    db.commit()
    return list_session_attendance(db, session)


def get_player_attendance(
    db: Session, user: User, player_id: uuid.UUID, program_id: uuid.UUID | None
) -> PlayerAttendanceResponse:
    player = db.get(Player, player_id)
    if player is None or not can_view_player_records(db, user, player):
        raise NotFoundError("Player not found", code="PLAYER_NOT_FOUND")

    query = (
        select(Attendance)
        .join(TrainingSession, TrainingSession.id == Attendance.session_id)
        .where(Attendance.player_id == player.id)
        .order_by(TrainingSession.starts_at.desc())
    )
    if user.role == Role.COACH:
        # Coaches only see attendance from their own programs.
        query = query.join(Program, Program.id == TrainingSession.program_id).where(
            Program.coach_id == user.id
        )
    if program_id is not None:
        query = query.where(TrainingSession.program_id == program_id)

    records = list(db.scalars(query))
    statuses = [record.status for record in records]
    return PlayerAttendanceResponse(
        summary=AttendanceSummary(
            present=statuses.count(AttendanceStatus.PRESENT),
            absent=statuses.count(AttendanceStatus.ABSENT),
            excused=statuses.count(AttendanceStatus.EXCUSED),
            total=len(statuses),
        ),
        records=[PlayerAttendanceRecord.from_attendance(record) for record in records],
    )
