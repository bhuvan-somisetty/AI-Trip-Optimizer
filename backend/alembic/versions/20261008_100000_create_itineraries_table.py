"""create itineraries table and add trips.failure_reason

Revision ID: 20261008_100000
Revises: 20261007_100000
Create Date: 2026-10-08 10:00:00
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261008_100000"
down_revision = "20261007_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("failure_reason", sa.String(), nullable=True))
    op.create_table(
        "itineraries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("flight", postgresql.JSONB(), nullable=False),
        sa.Column("hotel", postgresql.JSONB(), nullable=True),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("within_budget", sa.Boolean(), nullable=False),
        sa.Column("flags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("tradeoff_ledger", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    # One itinerary per trip: re-optimizing replaces the row.
    op.create_index("ix_itineraries_trip_id", "itineraries", ["trip_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_itineraries_trip_id", table_name="itineraries")
    op.drop_table("itineraries")
    op.drop_column("trips", "failure_reason")
