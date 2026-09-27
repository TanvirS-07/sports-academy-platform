import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, UnprocessableError
from app.policies import can_manage_program
from app.programs.models import Program
from app.programs.schemas import ProgramCreate, ProgramUpdate
from app.sports.models import Sport
from app.users.models import User


def _check_sport_exists(db: Session, sport_id: uuid.UUID) -> None:
    if db.get(Sport, sport_id) is None:
        raise UnprocessableError("That sport doesn't exist", code="SPORT_NOT_FOUND")


def list_programs_for_coach(db: Session, coach: User) -> list[Program]:
    return list(
        db.scalars(select(Program).where(Program.coach_id == coach.id).order_by(Program.name))
    )


def create_program(db: Session, coach: User, data: ProgramCreate) -> Program:
    _check_sport_exists(db, data.sport_id)
    program = Program(coach_id=coach.id, **data.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def get_program_for_coach(db: Session, coach: User, program_id: uuid.UUID) -> Program:
    program = db.get(Program, program_id)
    if program is None or not can_manage_program(coach, program):
        raise NotFoundError("Program not found", code="PROGRAM_NOT_FOUND")
    return program


def update_program(db: Session, program: Program, data: ProgramUpdate) -> Program:
    changes = data.model_dump(exclude_none=True)
    if "sport_id" in changes:
        _check_sport_exists(db, changes["sport_id"])
    for field, value in changes.items():
        setattr(program, field, value)
    db.commit()
    db.refresh(program)
    return program
