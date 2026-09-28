import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.players.models import Player
from app.sessions.models import TrainingSession


class BookingStatus(enum.StrEnum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Booking(Base):
    """A player booked into one training session.

    Cancelling keeps the row and marks it CANCELLED. The player can book again later,
    which adds a new row.
    """

    __tablename__ = "bookings"
    __table_args__ = (
        # One confirmed booking per player per session. Cancelled ones don't count.
        Index(
            "uq_bookings_confirmed_player",
            "session_id",
            "player_id",
            unique=True,
            postgresql_where="status = 'CONFIRMED'",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id"), index=True)
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), index=True)
    booked_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status"), default=BookingStatus.CONFIRMED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[TrainingSession] = relationship(lazy="joined")
    player: Mapped[Player] = relationship(lazy="joined")
