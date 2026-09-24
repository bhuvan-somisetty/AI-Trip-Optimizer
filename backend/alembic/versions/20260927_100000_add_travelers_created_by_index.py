"""add index on travelers.created_by

Revision ID: 20260927_100000
Revises: 20260921_100000
Create Date: 2026-09-27 10:00:00
"""
from alembic import op

revision = "20260927_100000"
down_revision = "20260921_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_travelers_created_by", "travelers", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_travelers_created_by", table_name="travelers")
