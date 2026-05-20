"""users table and user_id columns

Revision ID: 20260520_0003
Revises: 20260520_0002
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260520_0003"
down_revision: str | None = "20260520_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEV_USER_ID = "user_dev"
DEV_USER_DISPLAY_NAME = "开发用户"
DEV_USER_TIMEZONE = "Asia/Shanghai"


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.execute(
        sa.text(
            "INSERT INTO users (id, display_name, timezone, locale, created_at, updated_at) "
            "VALUES (:id, :display_name, :timezone, NULL, NOW(), NOW())"
        ).bindparams(
            id=DEV_USER_ID,
            display_name=DEV_USER_DISPLAY_NAME,
            timezone=DEV_USER_TIMEZONE,
        )
    )

    for table in ("reminders", "contacts", "contact_methods", "contact_aliases"):
        op.add_column(table, sa.Column("user_id", sa.String(length=64), nullable=True))

    op.execute(sa.text(f"UPDATE reminders SET user_id = '{DEV_USER_ID}'"))
    op.execute(sa.text(f"UPDATE contacts SET user_id = '{DEV_USER_ID}'"))
    op.execute(
        sa.text(
            "UPDATE contact_methods SET user_id = :user_id "
            "FROM contacts WHERE contacts.id = contact_methods.contact_id"
        ).bindparams(user_id=DEV_USER_ID)
    )
    op.execute(
        sa.text(
            "UPDATE contact_aliases SET user_id = :user_id "
            "FROM contacts WHERE contacts.id = contact_aliases.contact_id"
        ).bindparams(user_id=DEV_USER_ID)
    )

    for table in ("reminders", "contacts", "contact_methods", "contact_aliases"):
        op.alter_column(table, "user_id", nullable=False)
        op.create_foreign_key(
            f"fk_{table}_user_id",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])


def downgrade() -> None:
    for table in ("contact_aliases", "contact_methods", "contacts", "reminders"):
        op.drop_constraint(f"fk_{table}_user_id", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")

    op.drop_table("users")
