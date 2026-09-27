import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.players.models import Player
from app.policies import can_manage_program
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
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


def list_enrolments(db: Session, program: Program) -> list[ProgramPlayer]:
    return list(
        db.scalars(
            select(ProgramPlayer)
            .join(ProgramPlayer.player)
            .where(ProgramPlayer.program_id == program.id)
            .order_by(ProgramPlayer.status, Player.first_name, Player.last_name)
        )
    )


def enrol_player(db: Session, program: Program, player_id: uuid.UUID) -> ProgramPlayer:
    if db.get(Player, player_id) is None:
        raise UnprocessableError("That player doesn't exist", code="PLAYER_NOT_FOUND")

    enrolment = db.get(ProgramPlayer, (program.id, player_id))
    if enrolment is not None and enrolment.status == EnrolmentStatus.ACTIVE:
        raise ConflictError("This player is already enrolled", code="ALREADY_ENROLLED")

    if enrolment is None:
        enrolment = ProgramPlayer(program_id=program.id, player_id=player_id)
        db.add(enrolment)
    else:
        # Enrolling a player who left earlier makes their old enrolment active again.
        enrolment.status = EnrolmentStatus.ACTIVE

    try:
        db.commit()
    except IntegrityError as exc:
        # The primary key also stops two requests enrolling the same player at once.
        db.rollback()
        raise ConflictError("This player is already enrolled", code="ALREADY_ENROLLED") from exc
    db.refresh(enrolment)
    return enrolment


def get_enrolment(db: Session, program: Program, player_id: uuid.UUID) -> ProgramPlayer:
    enrolment = db.get(ProgramPlayer, (program.id, player_id))
    if enrolment is None:
        raise NotFoundError("This player isn't enrolled in the program", code="ENROLMENT_NOT_FOUND")
    return enrolment


def set_enrolment_status(
    db: Session, enrolment: ProgramPlayer, status: EnrolmentStatus
) -> ProgramPlayer:
    enrolment.status = status
    db.commit()
    db.refresh(enrolment)
    return enrolment
