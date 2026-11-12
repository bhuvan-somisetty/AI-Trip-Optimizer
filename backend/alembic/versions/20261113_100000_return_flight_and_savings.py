"""return flight and savings on itineraries (round-trip totals, PRD US-010 savings)

Revision ID: 20261113_100000
Revises: 20261112_120000
Create Date: 2026-11-13 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261113_100000"
down_revision = "20261112_120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Both stay NULL on itineraries saved before this: no return was searched, no savings worked out.
    op.add_column("itineraries", sa.Column("return_flight", sa.JSON(), nullable=True))
    op.add_column("itineraries", sa.Column("savings", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("itineraries", "savings")
    op.drop_column("itineraries", "return_flight")
