"""add wechat_notify_requested to reminders and calendar_events

Revision ID: 20260623_0017
Revises: 20260608_0016
Create Date: 2026-06-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260623_0017"
down_revision: str | None = "20260608_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reminders",
        sa.Column("wechat_notify_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "calendar_events",
        sa.Column("wechat_notify_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    # Expand migration: keep the added columns on downgrade so application rollback
    # does not discard user notification intent written after this migration.
    pass
