import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.bookings import service
from app.bookings.schemas import BookingResponse, BookRequest, SessionBookingResponse
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.sessions.service import get_session_for_coach
from app.users.models import Role, User

router = APIRouter(tags=["bookings"])

Coach = Annotated[User, Depends(require_role(Role.COACH))]
Parent = Annotated[User, Depends(require_role(Role.PARENT))]
CoachOrParent = Annotated[User, Depends(require_role(Role.COACH, Role.PARENT))]
Db = Annotated[Session, Depends(get_db)]
SESSION_NOT_FOUND = {404: {"model": ErrorResponse, "description": "Session not found"}}


@router.get(
    "/sessions/{session_id}/bookings",
    response_model=list[SessionBookingResponse],
    responses=SESSION_NOT_FOUND,
    summary="Players booked into a session (the session's coach)",
)
def list_session_bookings(
    session_id: uuid.UUID, coach: Coach, db: Db
) -> list[SessionBookingResponse]:
    session = get_session_for_coach(db, coach, session_id)
    bookings = service.list_session_bookings(db, session)
    return [SessionBookingResponse.from_booking(booking) for booking in bookings]


@router.post(
    "/sessions/{session_id}/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        **SESSION_NOT_FOUND,
        409: {
            "model": ErrorResponse,
            "description": "Session full, already booked, or cancelled or started",
        },
        422: {"model": ErrorResponse, "description": "Unknown player or player not enrolled"},
    },
    summary="Book one of your children into a session",
)
def book_player(
    session_id: uuid.UUID, data: BookRequest, parent: Parent, db: Db
) -> BookingResponse:
    booking = service.book_player(db, parent, session_id, data.player_id)
    return BookingResponse.from_booking(booking)


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
    summary="Your children's bookings for sessions that haven't finished",
)
def list_bookings(
    parent: Parent, db: Db, player_id: uuid.UUID | None = None
) -> list[BookingResponse]:
    bookings = service.list_bookings_for_parent(db, parent, player_id)
    return [BookingResponse.from_booking(booking) for booking in bookings]


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Booking not found"},
        409: {"model": ErrorResponse, "description": "Already cancelled or session started"},
    },
    summary="Cancel a booking (the player's parent or the session's coach)",
)
def cancel_booking(booking_id: uuid.UUID, user: CoachOrParent, db: Db) -> BookingResponse:
    booking = service.cancel_booking(db, user, booking_id)
    return BookingResponse.from_booking(booking)
