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
    op.add_column("tags", sa.Column("color", sa.String(length=16), nullable=True))
    op.add_column("tags", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE tags SET color = '#007AFF' WHERE color IS NULL")
    op.execute("UPDATE tags SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("tags", "color", nullable=False)
    op.alter_column("tags", "updated_at", nullable=False)


def downgrade() -> None:
    op.drop_column("tags", "updated_at")
    op.drop_column("tags", "color")
