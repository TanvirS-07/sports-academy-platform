import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.programs import service
from app.programs.schemas import ProgramCreate, ProgramResponse, ProgramUpdate
from app.users.models import Role, User

router = APIRouter(prefix="/programs", tags=["programs"])

Coach = Annotated[User, Depends(require_role(Role.COACH))]
Db = Annotated[Session, Depends(get_db)]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Program not found"}}
BAD_SPORT = {422: {"model": ErrorResponse, "description": "Invalid data or unknown sport"}}


@router.get("", response_model=list[ProgramResponse], summary="The coach's programs")
def list_programs(coach: Coach, db: Db) -> list[ProgramResponse]:
    programs = service.list_programs_for_coach(db, coach)
    return [ProgramResponse.model_validate(program) for program in programs]


@router.post(
    "",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    responses=BAD_SPORT,
    summary="Create a program",
)
def create_program(data: ProgramCreate, coach: Coach, db: Db) -> ProgramResponse:
    program = service.create_program(db, coach, data)
    return ProgramResponse.model_validate(program)


@router.get(
    "/{program_id}", response_model=ProgramResponse, responses=NOT_FOUND, summary="One program"
)
def get_program(program_id: uuid.UUID, coach: Coach, db: Db) -> ProgramResponse:
    program = service.get_program_for_coach(db, coach, program_id)
    return ProgramResponse.model_validate(program)


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
    responses={**NOT_FOUND, **BAD_SPORT},
    summary="Edit a program",
)
def update_program(
    program_id: uuid.UUID, data: ProgramUpdate, coach: Coach, db: Db
) -> ProgramResponse:
    program = service.get_program_for_coach(db, coach, program_id)
    program = service.update_program(db, program, data)
    return ProgramResponse.model_validate(program)
