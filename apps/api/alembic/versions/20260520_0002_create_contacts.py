"""create contacts tables

Revision ID: 20260520_0002
Revises: 20260520_0001
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260520_0002"
down_revision: str | None = "20260520_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("nickname", sa.String(length=255), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_contacts_display_name", "contacts", ["display_name"])
    op.create_index("ix_contacts_company", "contacts", ["company"])

    op.create_table(
        "contact_methods",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "contact_id",
            sa.String(length=64),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=True),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("normalized_value", sa.String(length=255), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_contact_methods_contact_id",
        "contact_methods",
        ["contact_id"],
    )
    op.create_index(
        "ix_contact_methods_type_normalized_value",
        "contact_methods",
        ["type", "normalized_value"],
    )

    op.create_table(
        "contact_aliases",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "contact_id",
            sa.String(length=64),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alias", sa.String(length=255), nullable=False),
        sa.Column("normalized_alias", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_contact_aliases_contact_id", "contact_aliases", ["contact_id"])
    op.create_index(
        "ix_contact_aliases_normalized_alias",
        "contact_aliases",
        ["normalized_alias"],
    )


def downgrade() -> None:
    op.drop_index("ix_contact_aliases_normalized_alias", table_name="contact_aliases")
    op.drop_index("ix_contact_aliases_contact_id", table_name="contact_aliases")
    op.drop_table("contact_aliases")

    op.drop_index("ix_contact_methods_type_normalized_value", table_name="contact_methods")
    op.drop_index("ix_contact_methods_contact_id", table_name="contact_methods")
    op.drop_table("contact_methods")

    op.drop_index("ix_contacts_company", table_name="contacts")
    op.drop_index("ix_contacts_display_name", table_name="contacts")
    op.drop_table("contacts")
