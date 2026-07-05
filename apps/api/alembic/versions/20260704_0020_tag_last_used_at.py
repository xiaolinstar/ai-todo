"""tag last used metadata

Revision ID: 20260704_0020
Revises: 20260701_0019
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260704_0020"
down_revision: str | None = "20260701_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Expand-only migration: keep added metadata on rollback to avoid data loss.
    pass
