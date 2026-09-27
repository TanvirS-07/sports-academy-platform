import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.programs.models import EnrolmentStatus, ProgramPlayer
from app.sports.schemas import SportResponse

ProgramName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
AgeGroup = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class ProgramCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ProgramName
    sport_id: uuid.UUID
    age_group: AgeGroup
    description: LongText = ""
    objectives: LongText = ""


class ProgramUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ProgramName | None = None
    sport_id: uuid.UUID | None = None
    age_group: AgeGroup | None = None
    description: LongText | None = None
    objectives: LongText | None = None


class ProgramResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    sport: SportResponse
    age_group: str
    description: str
    objectives: str


class EnrolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_id: uuid.UUID


class EnrolmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: EnrolmentStatus


class EnrolmentResponse(BaseModel):
    player_id: uuid.UUID
    first_name: str
    last_name: str
    # Only shown while the enrolment is active, so a coach stops seeing it once the
    # player leaves their program.
    date_of_birth: date | None
    status: EnrolmentStatus
    enrolled_at: datetime

    @classmethod
    def from_enrolment(cls, enrolment: ProgramPlayer) -> "EnrolmentResponse":
        player = enrolment.player
        active = enrolment.status == EnrolmentStatus.ACTIVE
        return cls(
            player_id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            date_of_birth=player.date_of_birth if active else None,
            status=enrolment.status,
            enrolled_at=enrolment.enrolled_at,
        )
