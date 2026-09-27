import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.players.models import ParentPlayer, Player
from app.players.schemas import PlayerCreate, PlayerProgram, PlayerSearchResult, PlayerUpdate
from app.policies import can_act_for_player
from app.programs.models import EnrolmentStatus, Program, ProgramPlayer
from app.users.models import User

PLAYER_NOT_FOUND_MESSAGE = "Player not found"
SEARCH_LIMIT = 20


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


def list_active_programs(db: Session, player: Player) -> list[PlayerProgram]:
    programs = db.scalars(
        select(Program)
        .join(ProgramPlayer, ProgramPlayer.program_id == Program.id)
        .where(
            ProgramPlayer.player_id == player.id,
            ProgramPlayer.status == EnrolmentStatus.ACTIVE,
        )
        .order_by(Program.name)
    )
    return [
        PlayerProgram(
            id=program.id,
            name=program.name,
            sport=program.sport.name,
            age_group=program.age_group,
            coach_name=f"{program.coach.first_name} {program.coach.last_name}",
        )
        for program in programs
    ]


def search_players(db: Session, query: str) -> list[PlayerSearchResult]:
    full_name = func.concat(Player.first_name, " ", Player.last_name)
    players = list(
        db.scalars(
            select(Player)
            .where(full_name.icontains(query, autoescape=True))
            .order_by(Player.first_name, Player.last_name)
            .limit(SEARCH_LIMIT)
        )
    )

    parent_names: dict[uuid.UUID, list[str]] = {player.id: [] for player in players}
    rows = db.execute(
        select(ParentPlayer.player_id, User.first_name)
        .join(User, User.id == ParentPlayer.parent_id)
        .where(ParentPlayer.player_id.in_(parent_names))
        .order_by(User.first_name)
    )
    for player_id, first_name in rows:
        parent_names[player_id].append(first_name)

    return [
        PlayerSearchResult(
            id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            parent_first_names=parent_names[player.id],
        )
        for player in players
    ]
