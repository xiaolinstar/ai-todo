"""reclassify legacy WeChat login rows that were marked as pat

Revision ID: 20260527_0011
Revises: 20260527_0010
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260527_0011"
down_revision: str | None = "20260527_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE api_tokens SET token_type = 'session', client_kind = 'miniapp' "
            "WHERE token_type = 'pat' AND ("
            "name LIKE 'WeChat %' OR name = 'Miniapp Local'"
            ")"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE api_tokens SET token_type = 'pat' "
            "WHERE token_type = 'session' AND name LIKE 'WeChat %'"
        )
    )
