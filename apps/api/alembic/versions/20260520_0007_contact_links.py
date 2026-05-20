"""reminder and calendar contact link tables

Revision ID: 20260520_0007
Revises: 20260520_0006
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260520_0007"
down_revision: str | None = "20260520_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reminder_contacts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "reminder_id",
            sa.String(length=64),
            sa.ForeignKey("reminders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            sa.String(length=64),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reminder_contacts_reminder_id", "reminder_contacts", ["reminder_id"])
    op.create_index("ix_reminder_contacts_contact_id", "reminder_contacts", ["contact_id"])

    op.create_table(
        "calendar_event_contacts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "calendar_event_id",
            sa.String(length=64),
            sa.ForeignKey("calendar_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            sa.String(length=64),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_calendar_event_contacts_event_id",
        "calendar_event_contacts",
        ["calendar_event_id"],
    )
    op.create_index(
        "ix_calendar_event_contacts_contact_id",
        "calendar_event_contacts",
        ["contact_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_calendar_event_contacts_contact_id", table_name="calendar_event_contacts")
    op.drop_index("ix_calendar_event_contacts_event_id", table_name="calendar_event_contacts")
    op.drop_table("calendar_event_contacts")

    op.drop_index("ix_reminder_contacts_contact_id", table_name="reminder_contacts")
    op.drop_index("ix_reminder_contacts_reminder_id", table_name="reminder_contacts")
    op.drop_table("reminder_contacts")
