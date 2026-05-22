"""create identities table

Revision ID: 20260521_0008
Revises: 20260520_0007
Create Date: 2026-05-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260521_0008"
down_revision: str | None = "20260520_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identities",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_subject", sa.String(length=128), nullable=False),
        sa.Column("union_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_identities_provider_subject"),
    )
    op.create_index("ix_identities_user_id", "identities", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_identities_user_id", table_name="identities")
    op.drop_table("identities")
