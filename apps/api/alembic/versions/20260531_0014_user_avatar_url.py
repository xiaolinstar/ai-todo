"""add user avatar url

Revision ID: 20260531_0014
Revises: 20260531_0013
Create Date: 2026-05-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260531_0014"
down_revision: str | None = "20260531_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))


def downgrade() -> None:
    pass
