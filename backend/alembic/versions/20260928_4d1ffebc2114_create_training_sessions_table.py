"""Create training_sessions table.

Revision ID: 4d1ffebc2114
Revises: e81a4f6c2b97
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4d1ffebc2114"
down_revision: str | None = "e81a4f6c2b97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "training_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("program_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("booked_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "status", sa.Enum("SCHEDULED", "CANCELLED", name="session_status"), nullable=False
        ),
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
        sa.CheckConstraint("capacity > 0", name=op.f("ck_training_sessions_capacity_positive")),
        sa.CheckConstraint(
            "booked_count >= 0", name=op.f("ck_training_sessions_booked_count_not_negative")
        ),
        sa.CheckConstraint(
            "booked_count <= capacity", name=op.f("ck_training_sessions_not_overbooked")
        ),
        sa.CheckConstraint(
            "ends_at > starts_at", name=op.f("ck_training_sessions_ends_after_start")
        ),
        sa.ForeignKeyConstraint(
            ["program_id"],
            ["programs.id"],
            name=op.f("fk_training_sessions_program_id_programs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_training_sessions")),
    )
    op.create_index(
        op.f("ix_training_sessions_program_id"), "training_sessions", ["program_id"], unique=False
    )
    op.create_index(
        op.f("ix_training_sessions_starts_at"), "training_sessions", ["starts_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_training_sessions_starts_at"), table_name="training_sessions")
    op.drop_index(op.f("ix_training_sessions_program_id"), table_name="training_sessions")
    op.drop_table("training_sessions")
    # drop_table leaves the enum type behind, so drop it too.
    sa.Enum(name="session_status").drop(op.get_bind(), checkfirst=True)
