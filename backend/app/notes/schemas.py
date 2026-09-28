import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints, model_validator

from app.notes.models import DevelopmentNote
from app.sessions.schemas import UtcDateTime

NoteText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
EMPTY_NOTE_MESSAGE = "Fill in at least one of skills, improvements or progress"


def _not_in_the_future(value: date) -> date:
    # The frontend sends today's date in Sydney, which can be a day ahead of UTC.
    # Allowing one extra day keeps time zones out of the backend.
    if value > datetime.now(UTC).date() + timedelta(days=1):
        raise ValueError("The date can't be in the future")
    return value


NotedOn = Annotated[date, AfterValidator(_not_in_the_future)]


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    program_id: uuid.UUID
    noted_on: NotedOn
    skills: NoteText = ""
    improvements: NoteText = ""
    progress: NoteText = ""

    @model_validator(mode="after")
    def not_empty(self) -> Self:
        if not (self.skills or self.improvements or self.progress):
            raise ValueError(EMPTY_NOTE_MESSAGE)
        return self


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    noted_on: NotedOn | None = None
    skills: NoteText | None = None
    improvements: NoteText | None = None
    progress: NoteText | None = None


class NoteProgram(BaseModel):
    id: uuid.UUID
    name: str


class NoteResponse(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    program: NoteProgram
    coach_id: uuid.UUID
    coach_name: str
    noted_on: date
    skills: str
    improvements: str
    progress: str
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @classmethod
    def from_note(cls, note: DevelopmentNote) -> "NoteResponse":
        return cls(
            id=note.id,
            player_id=note.player_id,
            program=NoteProgram(id=note.program.id, name=note.program.name),
            coach_id=note.coach_id,
            coach_name=f"{note.coach.first_name} {note.coach.last_name}",
            noted_on=note.noted_on,
            skills=note.skills,
            improvements=note.improvements,
            progress=note.progress,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
