"""tag metadata

Revision ID: 20260701_0019
Revises: 20260701_0018
Create Date: 2026-07-01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260701_0019"
down_revision: str | None = "20260701_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tags",
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#007AFF"),
    )
    op.add_column(
        "tags",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.alter_column("tags", "color", server_default=None)
    op.alter_column("tags", "updated_at", server_default=None)


def downgrade() -> None:
    # Expand-only migration: keep added columns on rollback to avoid destructive schema changes.
    pass
