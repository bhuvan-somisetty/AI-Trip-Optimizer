"""allow users without a password (Google sign-in)

Revision ID: 20261112_100000
Revises: 20261111_100000
Create Date: 2026-11-12 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261112_100000"
down_revision = "20261111_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Fails if Google-only accounts exist; give them a password or remove them first.
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
