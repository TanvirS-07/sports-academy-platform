import uuid

from pydantic import BaseModel, ConfigDict

from app.bookings.models import Booking, BookingStatus
from app.sessions.schemas import SessionResponse, UtcDateTime


class BookRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_id: uuid.UUID


class BookingPlayer(BaseModel):
    """Name only. Date of birth isn't needed for bookings, so it's never sent."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str


class BookingResponse(BaseModel):
    """A booking as the parent sees it, with the session it's for."""

    id: uuid.UUID
    status: BookingStatus
    player: BookingPlayer
    session: SessionResponse
    created_at: UtcDateTime
    cancelled_at: UtcDateTime | None

    @classmethod
    def from_booking(cls, booking: Booking) -> "BookingResponse":
        return cls(
            id=booking.id,
            status=booking.status,
            player=BookingPlayer.model_validate(booking.player),
            session=SessionResponse.from_session(booking.session),
            created_at=booking.created_at,
            cancelled_at=booking.cancelled_at,
        )


class SessionBookingResponse(BaseModel):
    """One row in the list of players booked into a session, for the coach."""

    id: uuid.UUID
    player: BookingPlayer
    created_at: UtcDateTime

    @classmethod
    def from_booking(cls, booking: Booking) -> "SessionBookingResponse":
        return cls(
            id=booking.id,
            player=BookingPlayer.model_validate(booking.player),
            created_at=booking.created_at,
        )
