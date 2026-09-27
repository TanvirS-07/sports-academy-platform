"""Create sports and programs tables, and add Cricket.

Revision ID: 5b7e2c9d0f14
Revises: c45d8ec30ead
Create Date: 2026-09-27
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5b7e2c9d0f14"
down_revision: str | None = "c45d8ec30ead"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Fixed so every database gets the same id for Cricket.
CRICKET_ID = uuid.UUID("0f3c6a52-7d1e-4b8a-9c2f-5e4d3b2a1c01")


def upgrade() -> None:
    sports = op.create_table(
        "sports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sports")),
        sa.UniqueConstraint("name", name=op.f("uq_sports_name")),
    )
    op.bulk_insert(sports, [{"id": CRICKET_ID, "name": "Cricket"}])

    op.create_table(
        "programs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("coach_id", sa.Uuid(), nullable=False),
        sa.Column("sport_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("age_group", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("objectives", sa.Text(), server_default="", nullable=False),
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
            ["coach_id"], ["users.id"], name=op.f("fk_programs_coach_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["sport_id"], ["sports.id"], name=op.f("fk_programs_sport_id_sports")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_programs")),
    )
    op.create_index(op.f("ix_programs_coach_id"), "programs", ["coach_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_programs_coach_id"), table_name="programs")
    op.drop_table("programs")
    op.drop_table("sports")
