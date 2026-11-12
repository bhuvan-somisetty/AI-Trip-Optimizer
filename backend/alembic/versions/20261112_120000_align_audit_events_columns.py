"""align an audit_events table made by an earlier draft of 20261112_110000

That draft created audit_events itself, with a `type` column and plain JSON payload, and
it ran on production before 20261111_100000 joined the history. This brings such a table
to the 20261111_100000 shape. On a database built from the current history it does nothing.

Revision ID: 20261112_120000
Revises: 20261112_110000
Create Date: 2026-11-12 12:00:00
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261112_120000"
down_revision = "20261112_110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("audit_events")}
    if "type" not in columns:
        return
    op.alter_column("audit_events", "type", new_column_name="event_type")
    op.alter_column(
        "audit_events", "payload", type_=postgresql.JSONB(), postgresql_using="payload::jsonb",
        server_default="{}",
    )
    # The draft wrote these names; 20261111_100000 calls them PIPELINE_RUN / PIPELINE_FAILED.
    op.execute("UPDATE audit_events SET event_type = 'PIPELINE_RUN' WHERE event_type = 'OPTIMIZED'")
    op.execute("UPDATE audit_events SET event_type = 'PIPELINE_FAILED' WHERE event_type = 'OPTIMIZATION_FAILED'")
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])


def downgrade() -> None:
    # Nothing to undo: the table now matches 20261111_100000, which owns it.
    pass
