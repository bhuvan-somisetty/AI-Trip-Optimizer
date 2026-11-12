"""keep search results and picked line items on itineraries, for edits (US-007)

Revision ID: 20261112_110000
Revises: 20261112_100000
Create Date: 2026-11-12 11:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261112_110000"
down_revision = "20261112_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("itineraries", sa.Column("search_results", sa.JSON(), nullable=True))
    op.add_column("itineraries", sa.Column("picked", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("itineraries", "picked")
    op.drop_column("itineraries", "search_results")
