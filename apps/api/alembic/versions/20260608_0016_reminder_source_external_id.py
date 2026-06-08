"""add reminder source external id

Revision ID: 20260608_0016
Revises: 20260605_0015
Create Date: 2026-06-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260608_0016"
down_revision: str | None = "20260605_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("source", sa.String(length=64), nullable=True))
    op.add_column("reminders", sa.Column("external_id", sa.String(length=255), nullable=True))
    op.add_column("reminders", sa.Column("source_meta", sa.JSON(), nullable=True))
    op.create_index(op.f("ix_reminders_source"), "reminders", ["source"], unique=False)
    op.create_index(
        "uq_reminders_user_source_external_id",
        "reminders",
        ["user_id", "source", "external_id"],
        unique=True,
        postgresql_where=sa.text("source IS NOT NULL AND external_id IS NOT NULL"),
        sqlite_where=sa.text("source IS NOT NULL AND external_id IS NOT NULL"),
    )


def downgrade() -> None:
    pass
