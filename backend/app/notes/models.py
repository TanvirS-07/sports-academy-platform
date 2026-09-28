import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.programs.models import Program
from app.users.models import User


class DevelopmentNote(Base):
    """A coach's note about a player, written in one of the coach's programs.

    The program decides who can see it: the player's parents, and the coach of that
    program. Other coaches of the same player don't see it.
    """

    __tablename__ = "development_notes"
    __table_args__ = (
        CheckConstraint("skills <> '' OR improvements <> '' OR progress <> ''", name="not_empty"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("players.id"), index=True)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"), index=True)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    noted_on: Mapped[date] = mapped_column(Date)
    skills: Mapped[str] = mapped_column(Text, default="", server_default="")
    improvements: Mapped[str] = mapped_column(Text, default="", server_default="")
    progress: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    program: Mapped[Program] = relationship(lazy="joined")
    coach: Mapped[User] = relationship(lazy="joined")
