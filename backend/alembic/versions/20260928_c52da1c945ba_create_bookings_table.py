"""Create bookings table.

Revision ID: c52da1c945ba
Revises: 4d1ffebc2114
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c52da1c945ba"
down_revision: str | None = "4d1ffebc2114"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bookings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("booked_by", sa.Uuid(), nullable=False),
        sa.Column(
            "status", sa.Enum("CONFIRMED", "CANCELLED", name="booking_status"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["booked_by"], ["users.id"], name=op.f("fk_bookings_booked_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["player_id"], ["players.id"], name=op.f("fk_bookings_player_id_players")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["training_sessions.id"],
            name=op.f("fk_bookings_session_id_training_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bookings")),
    )
    op.create_index(op.f("ix_bookings_player_id"), "bookings", ["player_id"], unique=False)
    op.create_index(op.f("ix_bookings_session_id"), "bookings", ["session_id"], unique=False)
    # A player can have only one confirmed booking per session. Cancelled ones don't count.
    op.create_index(
        "uq_bookings_confirmed_player",
        "bookings",
        ["session_id", "player_id"],
        unique=True,
        postgresql_where="status = 'CONFIRMED'",
    )


def downgrade() -> None:
    op.drop_index("uq_bookings_confirmed_player", table_name="bookings")
    op.drop_index(op.f("ix_bookings_session_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_player_id"), table_name="bookings")
    op.drop_table("bookings")
    # drop_table leaves the enum type behind, so drop it too.
    sa.Enum(name="booking_status").drop(op.get_bind(), checkfirst=True)
