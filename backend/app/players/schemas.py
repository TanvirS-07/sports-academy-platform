import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

from app.auth.schemas import Name


def _not_in_the_future(value: date) -> date:
    if value > date.today():
        raise ValueError("Date of birth can't be in the future")
    return value


class PlayerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Name
    last_name: Name
    date_of_birth: date

    @field_validator("date_of_birth")
    @classmethod
    def check_date_of_birth(cls, value: date) -> date:
        return _not_in_the_future(value)


class PlayerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Name | None = None
    last_name: Name | None = None
    date_of_birth: date | None = None

    @field_validator("date_of_birth")
    @classmethod
    def check_date_of_birth(cls, value: date | None) -> date | None:
        return None if value is None else _not_in_the_future(value)


class PlayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: date
