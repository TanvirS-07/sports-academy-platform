"""Create players and parent_players tables.

Revision ID: c45d8ec30ead
Revises: 8d2f4b6a1c3e
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c45d8ec30ead"
down_revision: str | None = "8d2f4b6a1c3e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "players",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_players_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_players")),
        sa.UniqueConstraint("user_id", name=op.f("uq_players_user_id")),
    )
    op.create_table(
        "parent_players",
        sa.Column("parent_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["users.id"],
            name=op.f("fk_parent_players_parent_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name=op.f("fk_parent_players_player_id_players"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("parent_id", "player_id", name=op.f("pk_parent_players")),
    )
    op.create_index(
        op.f("ix_parent_players_player_id"), "parent_players", ["player_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_parent_players_player_id"), table_name="parent_players")
    op.drop_table("parent_players")
    op.drop_table("players")
