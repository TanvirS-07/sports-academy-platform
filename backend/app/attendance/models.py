import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.players.models import Player
from app.sessions.models import TrainingSession


class AttendanceStatus(enum.StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    EXCUSED = "EXCUSED"


class Attendance(Base):
    """Whether a player came to a session. One row per player per session, which the
    coach can change later."""

    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("session_id", "player_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id"))
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, name="attendance_status")
    )
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    session: Mapped[TrainingSession] = relationship(lazy="joined")
    player: Mapped[Player] = relationship(lazy="joined")
