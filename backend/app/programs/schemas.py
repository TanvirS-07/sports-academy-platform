import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

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
