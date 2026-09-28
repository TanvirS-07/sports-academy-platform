"""Booking and cancelling.

Both lock the session row first (see lock_session), check the rules, then change the
booking and booked_count in the same transaction. Two parents trying to book the last
place are handled one after the other, so the second one sees the session is full.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.bookings.models import Booking, BookingStatus
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.players.models import ParentPlayer, Player
from app.policies import can_act_for_player, can_manage_session
from app.programs.models import EnrolmentStatus, ProgramPlayer
from app.sessions.models import SessionStatus, TrainingSession
from app.sessions.service import get_session_for_user, lock_session
from app.users.models import User


def _now() -> datetime:
    return datetime.now(UTC)


def _already_booked() -> ConflictError:
    return ConflictError("This player is already booked into the session", code="ALREADY_BOOKED")


def book_player(db: Session, parent: User, session_id: uuid.UUID, player_id: uuid.UUID) -> Booking:
    get_session_for_user(db, parent, session_id)
    player = db.get(Player, player_id)
    if player is None or not can_act_for_player(db, parent, player):
        raise UnprocessableError("That player doesn't exist", code="PLAYER_NOT_FOUND")

    session = lock_session(db, session_id)
    if session.status != SessionStatus.SCHEDULED or session.starts_at <= _now():
        raise ConflictError(
            "This session has been cancelled or has already started",
            code="SESSION_NOT_BOOKABLE",
        )

    enrolment = db.get(ProgramPlayer, (session.program_id, player.id))
    if enrolment is None or enrolment.status != EnrolmentStatus.ACTIVE:
        raise UnprocessableError(
            "This player isn't enrolled in the session's program", code="PLAYER_NOT_ENROLLED"
        )

    already_booked = db.scalar(
        select(
            exists().where(
                Booking.session_id == session.id,
                Booking.player_id == player.id,
                Booking.status == BookingStatus.CONFIRMED,
            )
        )
    )
    if already_booked:
        raise _already_booked()

    if session.booked_count >= session.capacity:
        raise ConflictError("This session is full", code="SESSION_FULL")

    booking = Booking(session_id=session.id, player_id=player.id, booked_by=parent.id)
    db.add(booking)
    session.booked_count += 1
    try:
        db.commit()
    except IntegrityError as exc:
        # The unique index is a second guard against booking the same player twice.
        db.rollback()
        raise _already_booked() from exc
    db.refresh(booking)
    return booking


def cancel_booking(db: Session, user: User, booking_id: uuid.UUID) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or not (
        can_act_for_player(db, user, booking.player) or can_manage_session(user, booking.session)
    ):
        raise NotFoundError("Booking not found", code="BOOKING_NOT_FOUND")

    session = lock_session(db, booking.session_id)
    # Read it again now the session is locked, in case it was cancelled in the meantime.
    db.refresh(booking)
    if booking.status != BookingStatus.CONFIRMED:
        raise ConflictError("This booking is already cancelled", code="BOOKING_NOT_CANCELLABLE")
    if session.starts_at <= _now():
        raise ConflictError("This session has already started", code="BOOKING_NOT_CANCELLABLE")

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = _now()
    session.booked_count -= 1
    db.commit()
    db.refresh(booking)
    return booking


def list_session_bookings(db: Session, session: TrainingSession) -> list[Booking]:
    return list(
        db.scalars(
            select(Booking)
            .join(Booking.player)
            .where(Booking.session_id == session.id, Booking.status == BookingStatus.CONFIRMED)
            .order_by(Player.first_name, Player.last_name)
        )
    )


def list_bookings_for_parent(
    db: Session, parent: User, player_id: uuid.UUID | None
) -> list[Booking]:
    """Bookings for sessions that haven't finished yet, cancelled ones included, so a
    parent can see when a coach cancelled something."""
    query = (
        select(Booking)
        .join(ParentPlayer, ParentPlayer.player_id == Booking.player_id)
        .join(TrainingSession, TrainingSession.id == Booking.session_id)
        .where(ParentPlayer.parent_id == parent.id, TrainingSession.ends_at > _now())
        .order_by(TrainingSession.starts_at, Booking.created_at)
    )
    if player_id is not None:
        query = query.where(Booking.player_id == player_id)
    return list(db.scalars(query))
