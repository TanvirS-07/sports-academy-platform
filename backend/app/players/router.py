import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.core.errors import ErrorResponse
from app.db.session import get_db
from app.players import service
from app.players.schemas import (
    PlayerCreate,
    PlayerDetailResponse,
    PlayerResponse,
    PlayerSearchRequest,
    PlayerSearchResult,
    PlayerUpdate,
)
from app.users.models import Role, User

router = APIRouter(prefix="/players", tags=["players"])

Parent = Annotated[User, Depends(require_role(Role.PARENT))]
Coach = Annotated[User, Depends(require_role(Role.COACH))]
Db = Annotated[Session, Depends(get_db)]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Player not found"}}


@router.get("", response_model=list[PlayerResponse], summary="The parent's players")
def list_players(parent: Parent, db: Db) -> list[PlayerResponse]:
    players = service.list_players_for_parent(db, parent)
    return [PlayerResponse.model_validate(player) for player in players]


@router.post(
    "",
    response_model=PlayerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a player",
)
def create_player(data: PlayerCreate, parent: Parent, db: Db) -> PlayerResponse:
    player = service.create_player(db, parent, data)
    return PlayerResponse.model_validate(player)


# A POST so children's names stay out of URLs and server logs.
@router.post(
    "/search",
    response_model=list[PlayerSearchResult],
    summary="Find players to enrol (coaches)",
)
def search_players(data: PlayerSearchRequest, _: Coach, db: Db) -> list[PlayerSearchResult]:
    return service.search_players(db, data.query)


@router.get(
    "/{player_id}",
    response_model=PlayerDetailResponse,
    responses=NOT_FOUND,
    summary="One player and their programs",
)
def get_player(player_id: uuid.UUID, parent: Parent, db: Db) -> PlayerDetailResponse:
    player = service.get_player_for_parent(db, parent, player_id)
    return PlayerDetailResponse(
        **PlayerResponse.model_validate(player).model_dump(),
        programs=service.list_active_programs(db, player),
    )


@router.patch(
    "/{player_id}", response_model=PlayerResponse, responses=NOT_FOUND, summary="Edit a player"
)
def update_player(
    player_id: uuid.UUID, data: PlayerUpdate, parent: Parent, db: Db
) -> PlayerResponse:
    player = service.get_player_for_parent(db, parent, player_id)
    player = service.update_player(db, player, data)
    return PlayerResponse.model_validate(player)
