import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.players.models import ParentPlayer, Player
from app.players.schemas import PlayerCreate, PlayerUpdate
from app.policies import can_act_for_player
from app.users.models import User

PLAYER_NOT_FOUND_MESSAGE = "Player not found"


def list_players_for_parent(db: Session, parent: User) -> list[Player]:
    return list(
        db.scalars(
            select(Player)
            .join(ParentPlayer, ParentPlayer.player_id == Player.id)
            .where(ParentPlayer.parent_id == parent.id)
            .order_by(Player.first_name, Player.last_name)
        )
    )


def create_player(db: Session, parent: User, data: PlayerCreate) -> Player:
    player = Player(**data.model_dump())
    db.add(player)
    db.flush()
    # The parent who adds a player is linked to them straight away.
    db.add(ParentPlayer(parent_id=parent.id, player_id=player.id))
    db.commit()
    db.refresh(player)
    return player


def get_player_for_parent(db: Session, parent: User, player_id: uuid.UUID) -> Player:
    player = db.get(Player, player_id)
    if player is None or not can_act_for_player(db, parent, player):
        raise NotFoundError(PLAYER_NOT_FOUND_MESSAGE, code="PLAYER_NOT_FOUND")
    return player


def update_player(db: Session, player: Player, data: PlayerUpdate) -> Player:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return player
