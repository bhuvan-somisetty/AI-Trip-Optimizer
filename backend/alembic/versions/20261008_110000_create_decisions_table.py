"""create decisions table

Revision ID: 20261008_110000
Revises: 20261008_100000
Create Date: 2026-10-08 11:00:00
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261008_110000"
down_revision = "20261008_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decisions_trip_id", "decisions", ["trip_id"])


def downgrade() -> None:
    op.drop_index("ix_decisions_trip_id", table_name="decisions")
    op.drop_table("decisions")
