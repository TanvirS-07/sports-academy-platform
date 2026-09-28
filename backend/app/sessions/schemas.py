import uuid
from datetime import UTC, datetime
from typing import Annotated

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
)

from app.sessions.models import SessionStatus, TrainingSession

Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Capacity = Annotated[int, Field(ge=1, le=100)]


def _as_utc(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


# Times always go out in UTC, whatever time zone the database connection uses.
# The frontend shows them in Sydney time.
UtcDateTime = Annotated[datetime, PlainSerializer(_as_utc, return_type=str)]


class SessionCreate(BaseModel):
    """Times must include an offset (for example 2026-10-03T10:00:00+10:00 or ...Z).
    Times without one are rejected, so the backend never has to guess a time zone."""

    model_config = ConfigDict(extra="forbid")

    program_id: uuid.UUID
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location: Location
    capacity: Capacity


class SessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    location: Location | None = None
    capacity: Capacity | None = None


class SessionProgram(BaseModel):
    id: uuid.UUID
    name: str
    coach_name: str


class SessionResponse(BaseModel):
    id: uuid.UUID
    program: SessionProgram
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    location: str
    capacity: int
    booked: int
    available: int
    status: SessionStatus

    @classmethod
    def from_session(cls, session: TrainingSession) -> "SessionResponse":
        program = session.program
        return cls(
            id=session.id,
            program=SessionProgram(
                id=program.id,
                name=program.name,
                coach_name=f"{program.coach.first_name} {program.coach.last_name}",
            ),
            starts_at=session.starts_at,
            ends_at=session.ends_at,
            location=session.location,
            capacity=session.capacity,
            booked=session.booked_count,
            available=session.available,
            status=session.status,
        )
