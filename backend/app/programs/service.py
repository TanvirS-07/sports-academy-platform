import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.bookings.models import Booking, BookingStatus
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.players.models import Player
from app.policies import can_manage_program
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
from app.programs.schemas import ProgramCreate, ProgramUpdate
from app.sessions.models import SessionStatus, TrainingSession
from app.sessions.service import lock_session
from app.sports.models import Sport
from app.users.models import User


def _now() -> datetime:
    return datetime.now(UTC)


def _check_sport_exists(db: Session, sport_id: uuid.UUID) -> None:
    if db.get(Sport, sport_id) is None:
        raise UnprocessableError("That sport doesn't exist", code="SPORT_NOT_FOUND")


def list_programs_for_coach(db: Session, coach: User) -> list[Program]:
    return list(
        db.scalars(select(Program).where(Program.coach_id == coach.id).order_by(Program.name))
    )


def create_program(db: Session, coach: User, data: ProgramCreate) -> Program:
    _check_sport_exists(db, data.sport_id)
    program = Program(coach_id=coach.id, **data.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def get_program_for_coach(db: Session, coach: User, program_id: uuid.UUID) -> Program:
    program = db.get(Program, program_id)
    if program is None or not can_manage_program(coach, program):
        raise NotFoundError("Program not found", code="PROGRAM_NOT_FOUND")
    return program


def update_program(db: Session, program: Program, data: ProgramUpdate) -> Program:
    changes = data.model_dump(exclude_none=True)
    if "sport_id" in changes:
        _check_sport_exists(db, changes["sport_id"])
    for field, value in changes.items():
        setattr(program, field, value)
    db.commit()
    db.refresh(program)
    return program


def list_enrolments(db: Session, program: Program) -> list[ProgramPlayer]:
    return list(
        db.scalars(
            select(ProgramPlayer)
            .join(ProgramPlayer.player)
            .where(ProgramPlayer.program_id == program.id)
            .order_by(ProgramPlayer.status, Player.first_name, Player.last_name)
        )
    )


def enrol_player(db: Session, program: Program, player_id: uuid.UUID) -> ProgramPlayer:
    if db.get(Player, player_id) is None:
        raise UnprocessableError("That player doesn't exist", code="PLAYER_NOT_FOUND")

    enrolment = db.get(ProgramPlayer, (program.id, player_id))
    if enrolment is not None and enrolment.status == EnrolmentStatus.ACTIVE:
        raise ConflictError("This player is already enrolled", code="ALREADY_ENROLLED")

    if enrolment is None:
        enrolment = ProgramPlayer(program_id=program.id, player_id=player_id)
        db.add(enrolment)
    else:
        # Enrolling a player who left earlier makes their old enrolment active again.
        enrolment.status = EnrolmentStatus.ACTIVE

    try:
        db.commit()
    except IntegrityError as exc:
        # The primary key also stops two requests enrolling the same player at once.
        db.rollback()
        raise ConflictError("This player is already enrolled", code="ALREADY_ENROLLED") from exc
    db.refresh(enrolment)
    return enrolment


def get_enrolment(db: Session, program: Program, player_id: uuid.UUID) -> ProgramPlayer:
    enrolment = db.get(ProgramPlayer, (program.id, player_id))
    if enrolment is None:
        raise NotFoundError("This player isn't enrolled in the program", code="ENROLMENT_NOT_FOUND")
    return enrolment


def set_enrolment_status(
    db: Session, enrolment: ProgramPlayer, status: EnrolmentStatus
) -> ProgramPlayer:
    if enrolment.status == EnrolmentStatus.ACTIVE and status == EnrolmentStatus.INACTIVE:
        _cancel_upcoming_bookings(db, enrolment)
    enrolment.status = status
    db.commit()
    db.refresh(enrolment)
    return enrolment


def _cancel_upcoming_bookings(db: Session, enrolment: ProgramPlayer) -> None:
    """Cancels the player's bookings for sessions in the program that haven't started yet,
    so their places go back to other players. Past bookings stay for attendance.

    Making the player active again doesn't bring these back; a parent books again.
    """
    session_ids = db.scalars(
        select(TrainingSession.id)
        .join(Booking, Booking.session_id == TrainingSession.id)
        .where(
            TrainingSession.program_id == enrolment.program_id,
            TrainingSession.status == SessionStatus.SCHEDULED,
            TrainingSession.starts_at > _now(),
            Booking.player_id == enrolment.player_id,
            Booking.status == BookingStatus.CONFIRMED,
        )
        # Always lock sessions in the same order, so two requests can't deadlock.
        .order_by(TrainingSession.id)
    ).all()

    for session_id in session_ids:
        session = lock_session(db, session_id)
        # Read the booking again now the session is locked, in case it was just cancelled.
        booking = db.scalar(
            select(Booking)
            .where(
                Booking.session_id == session.id,
                Booking.player_id == enrolment.player_id,
                Booking.status == BookingStatus.CONFIRMED,
            )
            .execution_options(populate_existing=True)
        )
        if booking is None or session.status != SessionStatus.SCHEDULED:
            continue
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = _now()
        session.booked_count -= 1
