"""Ownership checks: can this user see or change this record?

Role checks (coach or parent) are done by require_role in the routes. These functions
answer the next question, whether the user is linked to the specific record. Routes
return 404 when they say no, so users can't find out which ids exist.
"""

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.players.models import ParentPlayer, Player
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
from app.sessions.models import TrainingSession
from app.users.models import Role, User


def can_act_for_player(db: Session, user: User, player: Player) -> bool:
    """Parents can act for the players they're linked to."""
    if user.role != Role.PARENT:
        return False
    return bool(
        db.scalar(
            select(
                exists().where(
                    ParentPlayer.parent_id == user.id, ParentPlayer.player_id == player.id
                )
            )
        )
    )


def can_manage_program(user: User, program: Program) -> bool:
    """Coaches manage the programs they own."""
    return user.role == Role.COACH and program.coach_id == user.id


def can_manage_session(user: User, session: TrainingSession) -> bool:
    """Coaches manage the sessions in their own programs."""
    return can_manage_program(user, session.program)


def can_view_session(db: Session, user: User, session: TrainingSession) -> bool:
    """The session's coach, and parents with a child actively enrolled in its program."""
    if can_manage_session(user, session):
        return True
    if user.role != Role.PARENT:
        return False
    return bool(
        db.scalar(
            select(
                exists().where(
                    ParentPlayer.parent_id == user.id,
                    ProgramPlayer.player_id == ParentPlayer.player_id,
                    ProgramPlayer.program_id == session.program_id,
                    ProgramPlayer.status == EnrolmentStatus.ACTIVE,
                )
            )
        )
    )


def can_view_player_records(db: Session, user: User, player: Player) -> bool:
    """Attendance and development notes: the player's parents, and coaches who have the
    player in one of their programs. An inactive enrolment still counts, so a coach can
    look back at their own records. Routes then only show a coach their own programs."""
    if user.role == Role.PARENT:
        return can_act_for_player(db, user, player)
    if user.role != Role.COACH:
        return False
    return bool(
        db.scalar(
            select(
                exists().where(
                    ProgramPlayer.player_id == player.id,
                    ProgramPlayer.program_id == Program.id,
                    Program.coach_id == user.id,
                )
            )
        )
    )
