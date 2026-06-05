"""add api token lifecycle fields

Revision ID: 20260605_0015
Revises: 20260531_0014
Create Date: 2026-06-05
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260605_0015"
down_revision: str | None = "20260531_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("api_tokens", sa.Column("token_hint", sa.String(length=64), nullable=True))
    op.add_column("api_tokens", sa.Column("max_idle_days", sa.Integer(), nullable=True))


def downgrade() -> None:
    pass
