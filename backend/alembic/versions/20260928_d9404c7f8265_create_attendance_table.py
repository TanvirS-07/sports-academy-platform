"""Create attendance table.

Revision ID: d9404c7f8265
Revises: c52da1c945ba
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d9404c7f8265"
down_revision: str | None = "c52da1c945ba"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attendance",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PRESENT", "ABSENT", "EXCUSED", name="attendance_status"),
            nullable=False,
        ),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
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
            ["player_id"], ["players.id"], name=op.f("fk_attendance_player_id_players")
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"], ["users.id"], name=op.f("fk_attendance_recorded_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["training_sessions.id"],
            name=op.f("fk_attendance_session_id_training_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attendance")),
        sa.UniqueConstraint("session_id", "player_id", name=op.f("uq_attendance_session_id")),
    )
    op.create_index(op.f("ix_attendance_player_id"), "attendance", ["player_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_attendance_player_id"), table_name="attendance")
    op.drop_table("attendance")
    # drop_table leaves the enum type behind, so drop it too.
    sa.Enum(name="attendance_status").drop(op.get_bind(), checkfirst=True)
