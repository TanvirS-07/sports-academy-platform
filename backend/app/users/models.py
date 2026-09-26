import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Role(enum.StrEnum):
    COACH = "COACH"
    PARENT = "PARENT"
    # Player logins are added in a later phase. The value exists now so the
    # enum doesn't need another migration when that happens.
    PLAYER = "PLAYER"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # Emails are normalised to lowercase before saving, so a plain unique
        # constraint is enough to stop "Sam@x.com" and "sam@x.com" both registering.
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
