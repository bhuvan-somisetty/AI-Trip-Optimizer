"""create trips table

Revision ID: 20260921_100000
Revises: 20260917_162509
Create Date: 2026-09-21 10:00:00
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260921_100000"
down_revision = "20260917_162509"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("traveler_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("travelers.id"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("budget", sa.Numeric(12, 2), nullable=False),
        sa.Column("preferences", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trips_traveler_id", "trips", ["traveler_id"])
    op.create_index("ix_trips_status", "trips", ["status"])
    op.create_index("ix_trips_created_by", "trips", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_trips_created_by", table_name="trips")
    op.drop_index("ix_trips_status", table_name="trips")
    op.drop_index("ix_trips_traveler_id", table_name="trips")
    op.drop_table("trips")
