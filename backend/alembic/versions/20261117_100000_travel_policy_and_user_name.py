"""company travel policy, and a display name on users

Revision ID: 20261117_100000
Revises: 20261113_100000
Create Date: 2026-11-17 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261117_100000"
down_revision = "20261113_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NULL for existing users: the app shows the email until a name is set.
    op.add_column("users", sa.Column("name", sa.String(100), nullable=True))
    # One row (id 1) holds the company policy. No row yet means the built-in defaults apply.
    op.create_table(
        "travel_policy",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("manager_approval_flight_over", sa.Numeric(12, 2), nullable=False),
        sa.Column("max_nightly_rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("max_nightly_rate_intl", sa.Numeric(12, 2), nullable=False),
        sa.Column("business_class_min_hours", sa.Float(), nullable=False),
        sa.Column("advance_booking_days", sa.Integer(), nullable=False),
        sa.Column("preferred_airlines", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("travel_policy")
    op.drop_column("users", "name")
