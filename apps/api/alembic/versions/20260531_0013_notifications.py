"""add notification subscriptions and deliveries

Revision ID: 20260531_0013
Revises: 20260527_0012
Create Date: 2026-05-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260531_0013"
down_revision: str | None = "20260527_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("wechat_enabled", sa.Boolean(), nullable=False),
        sa.Column("default_reminder_enabled", sa.Boolean(), nullable=False),
        sa.Column("quiet_start", sa.String(length=8), nullable=True),
        sa.Column("quiet_end", sa.String(length=8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("template_id", sa.String(length=128), nullable=False),
        sa.Column("quota_remaining", sa.Integer(), nullable=False),
        sa.Column("last_request_result", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "provider",
            "template_key",
            "template_id",
            name="uq_notification_subscriptions_user_template",
        ),
    )
    op.create_index(
        op.f("ix_notification_subscriptions_user_id"),
        "notification_subscriptions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("template_id", sa.String(length=128), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("provider_message_id", sa.String(length=128), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "channel",
            "target_type",
            "target_id",
            "template_key",
            name="uq_notification_deliveries_target_template",
        ),
    )
    op.create_index(
        op.f("ix_notification_deliveries_scheduled_at"),
        "notification_deliveries",
        ["scheduled_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_deliveries_status"),
        "notification_deliveries",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_deliveries_user_id"),
        "notification_deliveries",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    pass
