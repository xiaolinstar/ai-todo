"""revoke accumulated dev-user PAT rows from local testing

Revision ID: 20260527_0012
Revises: 20260527_0011
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260527_0012"
down_revision: str | None = "20260527_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE api_tokens SET revoked_at = NOW() "
            "WHERE user_id = 'user_dev' AND token_type = 'pat' AND revoked_at IS NULL"
        )
    )


def downgrade() -> None:
    pass
