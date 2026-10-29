"""Add Google sign-in to users.

Revision ID: 7a3e91c4b5d2
Revises: 5fc75edc760f
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7a3e91c4b5d2"
down_revision: str | None = "5fc75edc760f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Google's "sub" claim: a stable id for the Google account, even if its email changes.
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_google_sub", "users", ["google_sub"])
    # Parents who only ever sign in with Google don't have a password.
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    # Accounts without a password can't be kept once the column is required again, and
    # deleting them would also delete their children and bookings. Stop instead.
    google_only = op.get_bind().scalar(
        sa.text("SELECT count(*) FROM users WHERE password_hash IS NULL")
    )
    if google_only:
        raise RuntimeError(
            f"{google_only} account(s) only sign in with Google and have no password. "
            "Give them a password or remove them before downgrading."
        )
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.drop_constraint("uq_users_google_sub", "users", type_="unique")
    op.drop_column("users", "google_sub")
