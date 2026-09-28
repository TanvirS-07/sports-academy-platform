import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.attendance.models import Attendance, AttendanceStatus
from app.bookings.schemas import BookingPlayer
from app.sessions.schemas import UtcDateTime


class AttendanceMark(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_id: uuid.UUID
    status: AttendanceStatus


class AttendanceUpdate(BaseModel):
    """The coach saves the whole list at once. Players left out keep what they had."""

    model_config = ConfigDict(extra="forbid")

    records: list[AttendanceMark] = Field(max_length=100)

    @field_validator("records")
    @classmethod
    def one_per_player(cls, records: list[AttendanceMark]) -> list[AttendanceMark]:
        if len({record.player_id for record in records}) != len(records):
            raise ValueError("Each player can only be listed once")
        return records


class SessionAttendanceRow(BaseModel):
    """A booked player and their attendance, or None if it hasn't been marked yet."""

    player: BookingPlayer
    status: AttendanceStatus | None


class AttendanceProgram(BaseModel):
    id: uuid.UUID
    name: str


class AttendanceSession(BaseModel):
    id: uuid.UUID
    program: AttendanceProgram
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    location: str


class PlayerAttendanceRecord(BaseModel):
    session: AttendanceSession
    status: AttendanceStatus

    @classmethod
    def from_attendance(cls, attendance: Attendance) -> "PlayerAttendanceRecord":
        session = attendance.session
        return cls(
            session=AttendanceSession(
                id=session.id,
                program=AttendanceProgram(id=session.program.id, name=session.program.name),
                starts_at=session.starts_at,
                ends_at=session.ends_at,
                location=session.location,
            ),
            status=attendance.status,
        )


class AttendanceSummary(BaseModel):
    present: int
    absent: int
    excused: int
    total: int


class PlayerAttendanceResponse(BaseModel):
    summary: AttendanceSummary
    records: list[PlayerAttendanceRecord]
