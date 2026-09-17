"""create travelers table

Revision ID: 20260917_162509
Revises: 20260916_151547
Create Date: 2026-09-17 16:25:09
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260917_162509"
down_revision = "20260916_151547"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "travelers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("preferences", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("travelers")
