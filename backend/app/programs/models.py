import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.players.models import Player
from app.sports.models import Sport
from app.users.models import User


class Program(Base):
    """A training program run by one coach, for example "U14 Cricket Development"."""

    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    sport_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sports.id"))
    name: Mapped[str] = mapped_column(String(150))
    age_group: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    objectives: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sport: Mapped[Sport] = relationship(lazy="joined")
    coach: Mapped[User] = relationship(lazy="joined")


class EnrolmentStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class ProgramPlayer(Base):
    """A player's enrolment in a program. Coaches make an enrolment inactive rather
    than deleting it, so the history stays."""

    __tablename__ = "program_players"

    program_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    status: Mapped[EnrolmentStatus] = mapped_column(
        Enum(EnrolmentStatus, name="enrolment_status"), default=EnrolmentStatus.ACTIVE
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    player: Mapped[Player] = relationship(lazy="joined")
