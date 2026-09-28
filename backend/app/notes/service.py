"""Development notes.

Parents see every note about their child. Coaches see the notes written in their own
programs, and only add notes for players who are actively enrolled in them.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, UnprocessableError
from app.notes.models import DevelopmentNote
from app.notes.schemas import EMPTY_NOTE_MESSAGE, NoteCreate, NoteUpdate
from app.players.models import Player
from app.policies import can_manage_program, can_view_player_records
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
from app.users.models import Role, User


def _get_player(db: Session, user: User, player_id: uuid.UUID) -> Player:
    player = db.get(Player, player_id)
    if player is None or not can_view_player_records(db, user, player):
        raise NotFoundError("Player not found", code="PLAYER_NOT_FOUND")
    return player


def list_notes(
    db: Session, user: User, player_id: uuid.UUID, program_id: uuid.UUID | None
) -> list[DevelopmentNote]:
    player = _get_player(db, user, player_id)
    query = (
        select(DevelopmentNote)
        .where(DevelopmentNote.player_id == player.id)
        .order_by(DevelopmentNote.noted_on.desc(), DevelopmentNote.created_at.desc())
    )
    if user.role == Role.COACH:
        query = query.join(Program, Program.id == DevelopmentNote.program_id).where(
            Program.coach_id == user.id
        )
    if program_id is not None:
        query = query.where(DevelopmentNote.program_id == program_id)
    return list(db.scalars(query))


def create_note(
    db: Session, coach: User, player_id: uuid.UUID, data: NoteCreate
) -> DevelopmentNote:
    player = _get_player(db, coach, player_id)
    program = db.get(Program, data.program_id)
    if program is None or not can_manage_program(coach, program):
        raise UnprocessableError("That program doesn't exist", code="PROGRAM_NOT_FOUND")
    enrolment = db.get(ProgramPlayer, (program.id, player.id))
    if enrolment is None or enrolment.status != EnrolmentStatus.ACTIVE:
        raise UnprocessableError(
            "This player isn't enrolled in that program", code="PLAYER_NOT_ENROLLED"
        )

    note = DevelopmentNote(player_id=player.id, coach_id=coach.id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, coach: User, note_id: uuid.UUID, data: NoteUpdate) -> DevelopmentNote:
    note = db.get(DevelopmentNote, note_id)
    # Only the coach who wrote a note can change it.
    if note is None or note.coach_id != coach.id:
        raise NotFoundError("Note not found", code="NOTE_NOT_FOUND")

    changes = data.model_dump(exclude_none=True)
    text = [
        changes.get(field, getattr(note, field)) for field in ("skills", "improvements", "progress")
    ]
    if not any(text):
        raise UnprocessableError(EMPTY_NOTE_MESSAGE, code="NOTE_EMPTY")

    for field, value in changes.items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note
