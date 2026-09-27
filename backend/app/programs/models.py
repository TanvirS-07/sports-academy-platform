import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
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
