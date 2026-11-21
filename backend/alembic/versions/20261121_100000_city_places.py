"""cached tourist attractions and restaurants per destination city

Revision ID: 20261121_100000
Revises: 20261117_100000
Create Date: 2026-11-21 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261121_100000"
down_revision = "20261117_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # One row per destination city; payload is what OpenTripMap returned, refreshed after
    # PLACES_CACHE_DAYS. Nothing else references it, so it can be emptied at any time.
    op.create_table(
        "city_places",
        sa.Column("city", sa.String(3), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("city_places")
