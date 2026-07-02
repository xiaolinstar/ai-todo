"""reminder tags and track entries

Revision ID: 20260701_0018
Revises: 20260623_0017
Create Date: 2026-07-01

ai-todo-migration: allow-destructive
Downgrade drops the reminder tag/track tables introduced by this same migration.
The upgrade path is expand-only; rollback is explicitly scoped to reverting this
feature migration before production use.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260701_0018"
down_revision: str | None = "20260623_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("normalized_name", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "normalized_name", name="uq_tags_user_normalized_name"),
    )
    op.create_index("ix_tags_user_id", "tags", ["user_id"])
    op.create_index("ix_tags_normalized_name", "tags", ["normalized_name"])

    op.create_table(
        "reminder_tags",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "reminder_id",
            sa.String(length=64),
            sa.ForeignKey("reminders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.String(length=64),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("reminder_id", "tag_id", name="uq_reminder_tags_reminder_tag"),
    )
    op.create_index("ix_reminder_tags_reminder_id", "reminder_tags", ["reminder_id"])
    op.create_index("ix_reminder_tags_tag_id", "reminder_tags", ["tag_id"])

    op.create_table(
        "reminder_track_entries",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "reminder_id",
            sa.String(length=64),
            sa.ForeignKey("reminders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date_label", sa.String(length=5), nullable=False),
        sa.Column("text", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_reminder_track_entries_reminder_id",
        "reminder_track_entries",
        ["reminder_id"],
    )
    op.create_index(
        "ix_reminder_track_entries_reminder_created",
        "reminder_track_entries",
        ["reminder_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_reminder_track_entries_reminder_created", table_name="reminder_track_entries")
    op.drop_index("ix_reminder_track_entries_reminder_id", table_name="reminder_track_entries")
    op.drop_table("reminder_track_entries")

    op.drop_index("ix_reminder_tags_tag_id", table_name="reminder_tags")
    op.drop_index("ix_reminder_tags_reminder_id", table_name="reminder_tags")
    op.drop_table("reminder_tags")

    op.drop_index("ix_tags_normalized_name", table_name="tags")
    op.drop_index("ix_tags_user_id", table_name="tags")
    op.drop_table("tags")
