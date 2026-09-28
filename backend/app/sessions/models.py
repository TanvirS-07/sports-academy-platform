import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.programs.models import Program


class SessionStatus(enum.StrEnum):
    SCHEDULED = "SCHEDULED"
    CANCELLED = "CANCELLED"


class TrainingSession(Base):
    """One training session in a program, for example Saturday 10:00 to 11:30.

    Called training_sessions so it isn't confused with a database session. The coach
    comes from the program. Times are stored as timestamptz, so they're always UTC in
    the database.
    """

    __tablename__ = "training_sessions"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint("booked_count >= 0", name="booked_count_not_negative"),
        # The booking code checks this too. The constraint is there in case it ever doesn't.
        CheckConstraint("booked_count <= capacity", name="not_overbooked"),
        CheckConstraint("ends_at > starts_at", name="ends_after_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String(200))
    capacity: Mapped[int] = mapped_column(Integer)
    booked_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status"), default=SessionStatus.SCHEDULED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    program: Mapped[Program] = relationship(lazy="joined")

    @property
    def available(self) -> int:
        return self.capacity - self.booked_count
