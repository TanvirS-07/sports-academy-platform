import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.notes import service
from app.notes.schemas import NoteCreate, NoteResponse, NoteUpdate
from app.users.models import Role, User

router = APIRouter(tags=["development notes"])

Coach = Annotated[User, Depends(require_role(Role.COACH))]
CoachOrParent = Annotated[User, Depends(require_role(Role.COACH, Role.PARENT))]
Db = Annotated[Session, Depends(get_db)]
PLAYER_NOT_FOUND = {404: {"model": ErrorResponse, "description": "Player not found"}}


@router.get(
    "/players/{player_id}/development-notes",
    response_model=list[NoteResponse],
    responses=PLAYER_NOT_FOUND,
    summary="A player's development notes (their parents, or their coaches for their own programs)",
)
def list_notes(
    player_id: uuid.UUID, user: CoachOrParent, db: Db, program_id: uuid.UUID | None = None
) -> list[NoteResponse]:
    notes = service.list_notes(db, user, player_id, program_id)
    return [NoteResponse.from_note(note) for note in notes]


@router.post(
    "/players/{player_id}/development-notes",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        **PLAYER_NOT_FOUND,
        422: {"model": ErrorResponse, "description": "Unknown program or player not enrolled"},
    },
    summary="Add a development note",
)
def create_note(player_id: uuid.UUID, data: NoteCreate, coach: Coach, db: Db) -> NoteResponse:
    note = service.create_note(db, coach, player_id, data)
    return NoteResponse.from_note(note)


@router.patch(
    "/development-notes/{note_id}",
    response_model=NoteResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Note not found"},
        422: {"model": ErrorResponse, "description": "The note would be empty"},
    },
    summary="Edit a development note (the coach who wrote it)",
)
def update_note(note_id: uuid.UUID, data: NoteUpdate, coach: Coach, db: Db) -> NoteResponse:
    note = service.update_note(db, coach, note_id, data)
    return NoteResponse.from_note(note)
