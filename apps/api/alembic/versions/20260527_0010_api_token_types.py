"""add token_type and client_kind to api_tokens

Revision ID: 20260527_0010
Revises: 20260526_0009
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260527_0010"
down_revision: str | None = "20260526_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "api_tokens",
        sa.Column("token_type", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "api_tokens",
        sa.Column("client_kind", sa.String(length=16), nullable=True),
    )

    op.execute(
        sa.text(
            "UPDATE api_tokens SET token_type = 'session', client_kind = 'miniapp' "
            "WHERE name LIKE 'WeChat Miniapp%'"
        )
    )
    op.execute(
        sa.text(
            "UPDATE api_tokens SET token_type = 'pat', client_kind = 'api' "
            "WHERE token_type IS NULL"
        )
    )

    op.alter_column("api_tokens", "token_type", nullable=False, server_default="pat")
    op.alter_column("api_tokens", "client_kind", nullable=False, server_default="api")


def downgrade() -> None:
    op.drop_column("api_tokens", "client_kind")
    op.drop_column("api_tokens", "token_type")
