"""add origin and destination to trips

Revision ID: 20261007_100000
Revises: 20260927_100000
Create Date: 2026-10-07 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261007_100000"
down_revision = "20260927_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No defaults: any trip created before this has no real route, so an existing
    # trips table must be empty (true for every dev database so far) for this to apply.
    op.add_column("trips", sa.Column("origin", sa.String(3), nullable=False))
    op.add_column("trips", sa.Column("destination", sa.String(3), nullable=False))


def downgrade() -> None:
    op.drop_column("trips", "destination")
    op.drop_column("trips", "origin")
