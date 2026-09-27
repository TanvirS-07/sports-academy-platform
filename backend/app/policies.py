"""Ownership checks: can this user see or change this record?

Role checks (coach or parent) are done by require_role in the routes. These functions
answer the next question, whether the user is linked to the specific record. Routes
return 404 when they say no, so users can't find out which ids exist.
"""

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.players.models import ParentPlayer, Player
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
