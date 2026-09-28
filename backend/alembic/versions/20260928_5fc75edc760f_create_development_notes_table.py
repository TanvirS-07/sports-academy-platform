"""Create development_notes table.

Revision ID: 5fc75edc760f
Revises: d9404c7f8265
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5fc75edc760f"
down_revision: str | None = "d9404c7f8265"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "development_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("program_id", sa.Uuid(), nullable=False),
        sa.Column("coach_id", sa.Uuid(), nullable=False),
        sa.Column("noted_on", sa.Date(), nullable=False),
        sa.Column("skills", sa.Text(), server_default="", nullable=False),
        sa.Column("improvements", sa.Text(), server_default="", nullable=False),
        sa.Column("progress", sa.Text(), server_default="", nullable=False),
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
        sa.CheckConstraint(
            "skills <> '' OR improvements <> '' OR progress <> ''",
            name=op.f("ck_development_notes_not_empty"),
        ),
        sa.ForeignKeyConstraint(
            ["coach_id"], ["users.id"], name=op.f("fk_development_notes_coach_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["player_id"], ["players.id"], name=op.f("fk_development_notes_player_id_players")
        ),
        sa.ForeignKeyConstraint(
            ["program_id"], ["programs.id"], name=op.f("fk_development_notes_program_id_programs")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_development_notes")),
    )
    op.create_index(
        op.f("ix_development_notes_player_id"), "development_notes", ["player_id"], unique=False
    )
    op.create_index(
        op.f("ix_development_notes_program_id"), "development_notes", ["program_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_development_notes_program_id"), table_name="development_notes")
    op.drop_index(op.f("ix_development_notes_player_id"), table_name="development_notes")
    op.drop_table("development_notes")
