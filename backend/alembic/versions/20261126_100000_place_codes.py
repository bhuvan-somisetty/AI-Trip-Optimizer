"""trip ends can be any Indian city or town, not only an airport

Revision ID: 20261126_100000
Revises: 20261121_100000
Create Date: 2026-11-26 10:00:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20261126_100000"
down_revision = "20261121_100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # An airport code ("BLR") or a place code ("ayodhya", "rampur-up"); widening keeps every row.
    for table, column in (("trips", "origin"), ("trips", "destination"), ("city_places", "city")):
        op.alter_column(table, column, type_=sa.String(40), existing_type=sa.String(3),
                        existing_nullable=False)


def downgrade() -> None:
    # Only safe while every trip still uses 3-letter airport codes.
    for table, column in (("trips", "origin"), ("trips", "destination"), ("city_places", "city")):
        op.alter_column(table, column, type_=sa.String(3), existing_type=sa.String(40),
                        existing_nullable=False)
