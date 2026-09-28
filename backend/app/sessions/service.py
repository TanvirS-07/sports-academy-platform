import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.players.models import ParentPlayer
from app.policies import can_manage_program, can_manage_session, can_view_session
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
from app.sessions.models import SessionStatus, TrainingSession
from app.sessions.schemas import SessionCreate, SessionUpdate
from app.users.models import Role, User

SESSION_NOT_FOUND_MESSAGE = "Session not found"


def _now() -> datetime:
    return datetime.now(UTC)


def _check_times(starts_at: datetime, ends_at: datetime) -> None:
    if ends_at <= starts_at:
        raise UnprocessableError("The session must end after it starts", code="INVALID_TIMES")
    if starts_at <= _now():
        raise UnprocessableError("The session must start in the future", code="INVALID_TIMES")


def _check_editable(session: TrainingSession) -> None:
    if session.status == SessionStatus.CANCELLED:
        raise ConflictError("This session has been cancelled", code="SESSION_NOT_EDITABLE")
    if session.starts_at <= _now():
        raise ConflictError("This session has already started", code="SESSION_NOT_EDITABLE")


def lock_session(db: Session, session_id: uuid.UUID) -> TrainingSession:
    """Loads the session and locks its row until the transaction ends.

    Anything that changes booked_count goes through here, so two requests can't read
    the same count and both write it back.
    """
    session = db.scalar(
        select(TrainingSession)
        .where(TrainingSession.id == session_id)
        .with_for_update(of=TrainingSession)
        # Reload it even if this database session already has it, so the count is fresh.
        .execution_options(populate_existing=True)
    )
    if session is None:
        raise NotFoundError(SESSION_NOT_FOUND_MESSAGE, code="SESSION_NOT_FOUND")
    return session


def list_sessions(
    db: Session, user: User, program_id: uuid.UUID | None, include_past: bool
) -> list[TrainingSession]:
    query = select(TrainingSession).order_by(TrainingSession.starts_at)
    if program_id is not None:
        query = query.where(TrainingSession.program_id == program_id)

    if user.role == Role.COACH:
        query = query.join(Program, Program.id == TrainingSession.program_id).where(
            Program.coach_id == user.id
        )
        if not include_past:
            query = query.where(TrainingSession.ends_at > _now())
        return list(db.scalars(query))

    # Parents see upcoming sessions in programs one of their children is active in.
    active_programs = (
        select(ProgramPlayer.program_id)
        .join(ParentPlayer, ParentPlayer.player_id == ProgramPlayer.player_id)
        .where(ParentPlayer.parent_id == user.id, ProgramPlayer.status == EnrolmentStatus.ACTIVE)
    )
    query = query.where(
        TrainingSession.program_id.in_(active_programs),
        TrainingSession.status == SessionStatus.SCHEDULED,
        TrainingSession.starts_at > _now(),
    )
    return list(db.scalars(query))


def get_session_for_user(db: Session, user: User, session_id: uuid.UUID) -> TrainingSession:
    session = db.get(TrainingSession, session_id)
    if session is None or not can_view_session(db, user, session):
        raise NotFoundError(SESSION_NOT_FOUND_MESSAGE, code="SESSION_NOT_FOUND")
    return session


def get_session_for_coach(db: Session, coach: User, session_id: uuid.UUID) -> TrainingSession:
    session = db.get(TrainingSession, session_id)
    if session is None or not can_manage_session(coach, session):
        raise NotFoundError(SESSION_NOT_FOUND_MESSAGE, code="SESSION_NOT_FOUND")
    return session


def create_session(db: Session, coach: User, data: SessionCreate) -> TrainingSession:
    program = db.get(Program, data.program_id)
    if program is None or not can_manage_program(coach, program):
        raise UnprocessableError("That program doesn't exist", code="PROGRAM_NOT_FOUND")
    _check_times(data.starts_at, data.ends_at)

    session = TrainingSession(**data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def update_session(db: Session, session: TrainingSession, data: SessionUpdate) -> TrainingSession:
    session = lock_session(db, session.id)
    _check_editable(session)

    changes = data.model_dump(exclude_none=True)
    if "starts_at" in changes or "ends_at" in changes:
        _check_times(
            changes.get("starts_at", session.starts_at), changes.get("ends_at", session.ends_at)
        )
    if changes.get("capacity", session.capacity) < session.booked_count:
        raise ConflictError(
            f"{session.booked_count} places are already booked, so the capacity can't be lower",
            code="CAPACITY_BELOW_BOOKED",
        )

    for field, value in changes.items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


def cancel_session(db: Session, session: TrainingSession) -> TrainingSession:
    session = lock_session(db, session.id)
    _check_editable(session)

    session.status = SessionStatus.CANCELLED
    db.commit()
    db.refresh(session)
    return session
