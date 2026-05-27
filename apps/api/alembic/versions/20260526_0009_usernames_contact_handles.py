"""add usernames and contact handles

Revision ID: 20260526_0009
Revises: 20260521_0008
Create Date: 2026-05-26
"""

from collections.abc import Sequence
import re

from alembic import op
import sqlalchemy as sa


revision: str = "20260526_0009"
down_revision: str | None = "20260521_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_FALLBACK_PINYIN = {
    "邢": "xing",
    "小": "xiao",
    "林": "lin",
    "王": "wang",
    "总": "zong",
    "张": "zhang",
    "三": "san",
}


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=64), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    with op.batch_alter_table("contacts") as batch_op:
        batch_op.add_column(sa.Column("linked_user_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("handle", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("handle_source", sa.String(length=32), nullable=True))

    _backfill_contact_handles()

    with op.batch_alter_table("contacts") as batch_op:
        batch_op.alter_column("handle", existing_type=sa.String(length=64), nullable=False)
        batch_op.alter_column("handle_source", existing_type=sa.String(length=32), nullable=False)
        batch_op.create_foreign_key(
            "fk_contacts_linked_user_id_users",
            "users",
            ["linked_user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_contacts_linked_user_id", ["linked_user_id"])
        batch_op.create_unique_constraint("uq_contacts_user_handle", ["user_id", "handle"])


def downgrade() -> None:
    with op.batch_alter_table("contacts") as batch_op:
        batch_op.drop_constraint("uq_contacts_user_handle", type_="unique")
        batch_op.drop_index("ix_contacts_linked_user_id")
        batch_op.drop_constraint("fk_contacts_linked_user_id_users", type_="foreignkey")
        batch_op.drop_column("handle_source")
        batch_op.drop_column("handle")
        batch_op.drop_column("linked_user_id")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")


def _backfill_contact_handles() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("select id, user_id, display_name from contacts order by user_id, created_at, id")
    ).mappings()

    used_by_user: dict[str, set[str]] = {}
    for row in rows:
        user_id = str(row["user_id"])
        used = used_by_user.setdefault(user_id, set())
        handle = _next_handle(_handle_seed(row["display_name"]), used)
        used.add(handle)
        connection.execute(
            sa.text(
                "update contacts set handle = :handle, handle_source = 'generated' where id = :id"
            ),
            {"handle": handle, "id": row["id"]},
        )


def _handle_seed(value: str | None) -> str:
    raw = (value or "").strip()
    transliterated = "".join(_FALLBACK_PINYIN.get(char, char) for char in raw)
    seed = re.sub(r"[^a-z0-9]+", "", transliterated.lower())
    return seed[:64] or "contact"


def _next_handle(seed: str, used: set[str]) -> str:
    if seed not in used:
        return seed

    for sequence in range(1, 100):
        suffix = f"{sequence:02d}"
        candidate = f"{seed[: 64 - len(suffix)]}{suffix}"
        if candidate not in used:
            return candidate

    raise RuntimeError(f"Unable to generate a unique handle from seed '{seed}'.")
