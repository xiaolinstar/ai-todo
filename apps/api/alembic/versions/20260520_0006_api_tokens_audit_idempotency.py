"""api tokens, command logs, idempotency records

Revision ID: 20260520_0006
Revises: 20260520_0005
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260520_0006"
down_revision: str | None = "20260520_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_tokens_user_id", "api_tokens", ["user_id"])
    op.create_index("ix_api_tokens_token_hash", "api_tokens", ["token_hash"], unique=True)

    op.create_table(
        "command_logs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "api_token_id",
            sa.String(length=64),
            sa.ForeignKey("api_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("operation", sa.String(length=128), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("target_type", sa.String(length=64), nullable=True),
        sa.Column("target_ids", sa.Text(), nullable=True),
        sa.Column("input_summary", sa.Text(), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_command_logs_user_id", "command_logs", ["user_id"])
    op.create_index("ix_command_logs_created_at", "command_logs", ["created_at"])

    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("operation", sa.String(length=128), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_idempotency_records_user_id", "idempotency_records", ["user_id"])
    op.create_index(
        "uq_idempotency_records_user_key",
        "idempotency_records",
        ["user_id", "idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_idempotency_records_user_key", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_user_id", table_name="idempotency_records")
    op.drop_table("idempotency_records")

    op.drop_index("ix_command_logs_created_at", table_name="command_logs")
    op.drop_index("ix_command_logs_user_id", table_name="command_logs")
    op.drop_table("command_logs")

    op.drop_index("ix_api_tokens_token_hash", table_name="api_tokens")
    op.drop_index("ix_api_tokens_user_id", table_name="api_tokens")
    op.drop_table("api_tokens")
