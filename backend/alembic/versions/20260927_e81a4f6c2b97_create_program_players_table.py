"""Create program_players table.

Revision ID: e81a4f6c2b97
Revises: 5b7e2c9d0f14
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e81a4f6c2b97"
down_revision: str | None = "5b7e2c9d0f14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "program_players",
        sa.Column("program_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "INACTIVE", name="enrolment_status"), nullable=False),
        sa.Column(
            "enrolled_at",
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
            ["player_id"],
            ["players.id"],
            name=op.f("fk_program_players_player_id_players"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["program_id"],
            ["programs.id"],
            name=op.f("fk_program_players_program_id_programs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("program_id", "player_id", name=op.f("pk_program_players")),
    )
    op.create_index(
        op.f("ix_program_players_player_id"), "program_players", ["player_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_program_players_player_id"), table_name="program_players")
    op.drop_table("program_players")
    # drop_table leaves the enum type behind, so drop it too.
    sa.Enum(name="enrolment_status").drop(op.get_bind(), checkfirst=True)
