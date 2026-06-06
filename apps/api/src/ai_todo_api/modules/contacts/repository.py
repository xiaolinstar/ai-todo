from dataclasses import dataclass

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ai_todo_api.common.cursor import decode_cursor, encode_cursor
from ai_todo_api.db.models import ContactAliasModel, ContactMethodModel, ContactModel
from ai_todo_api.modules.contacts.handles import normalize_handle
from ai_todo_api.modules.contacts.schemas import (
    ContactDetail,
    ContactMethodSummary,
    ContactSummary,
)


@dataclass
class ContactSearchPage:
    items: list[ContactModel]
    total_count: int
    next_cursor: str | None = None
    has_more: bool = False


class ContactRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def add(self, contact: ContactModel) -> ContactModel:
        self._session.add(contact)
        self._session.commit()
        self._session.refresh(contact)
        return self.get(contact.id) or contact

    def save(self, contact: ContactModel) -> ContactModel:
        self._session.commit()
        self._session.refresh(contact)
        return self.get(contact.id) or contact

    def delete(self, contact: ContactModel) -> str:
        contact_id = contact.id
        self._session.delete(contact)
        self._session.commit()
        return contact_id

    def get(self, contact_ref: str) -> ContactModel | None:
        statement = (
            select(ContactModel)
            .where(
                or_(
                    ContactModel.id == contact_ref,
                    ContactModel.handle == normalize_handle(contact_ref),
                ),
                ContactModel.user_id == self._user_id,
            )
            .options(
                selectinload(ContactModel.methods),
                selectinload(ContactModel.aliases),
            )
        )
        return self._session.scalar(statement)

    def handle_exists(self, handle: str, exclude_contact_id: str | None = None) -> bool:
        statement = select(ContactModel.id).where(
            ContactModel.user_id == self._user_id,
            ContactModel.handle == handle,
        )
        if exclude_contact_id:
            statement = statement.where(ContactModel.id != exclude_contact_id)
        return self._session.scalar(statement) is not None

    def next_available_handle(self, seed: str) -> str:
        base = seed[:64] or "contact"
        if not self.handle_exists(base):
            return base

        for sequence in range(1, 100):
            suffix = f"{sequence:02d}"
            candidate = f"{base[: 64 - len(suffix)]}{suffix}"
            if not self.handle_exists(candidate):
                return candidate

        raise ValueError("Unable to generate a unique contact handle.")

    def search(
        self,
        query: str | None = None,
        *,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> ContactSearchPage:
        statement = self._search_statement(query)
        total_count = self._count_search_matches(statement)

        ordered = statement.order_by(ContactModel.created_at.asc(), ContactModel.id.asc())
        if cursor:
            sort_at, row_id = decode_cursor(cursor)
            ordered = ordered.where(
                or_(
                    ContactModel.created_at > sort_at,
                    and_(ContactModel.created_at == sort_at, ContactModel.id > row_id),
                )
            )

        if limit is None:
            items = list(self._session.scalars(ordered))
            return ContactSearchPage(
                items=items,
                total_count=total_count,
                next_cursor=None,
                has_more=False,
            )

        rows = list(self._session.scalars(ordered.limit(limit + 1)))
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_cursor(sort_at=last.created_at, row_id=last.id)

        return ContactSearchPage(
            items=items,
            total_count=total_count,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    def _search_statement(self, query: str | None):
        statement = (
            select(ContactModel)
            .where(ContactModel.user_id == self._user_id)
            .options(
                selectinload(ContactModel.methods),
                selectinload(ContactModel.aliases),
            )
        )

        normalized_query = normalize_text(query)
        if not normalized_query:
            return statement

        pattern = f"%{normalized_query}%"
        normalized_handle_query = normalize_handle(query or "")
        handle_pattern = f"%{normalized_handle_query}%" if normalized_handle_query else pattern
        return (
            statement.outerjoin(ContactAliasModel)
            .where(
                or_(
                    ContactModel.handle.ilike(handle_pattern),
                    ContactModel.display_name.ilike(pattern),
                    ContactModel.nickname.ilike(pattern),
                    ContactModel.company.ilike(pattern),
                    ContactAliasModel.normalized_alias.ilike(pattern),
                )
            )
            .distinct()
        )

    def _count_search_matches(self, statement) -> int:
        count_statement = select(func.count()).select_from(
            statement.with_only_columns(ContactModel.id).distinct().subquery()
        )
        return int(self._session.scalar(count_statement) or 0)


def contact_to_summary(contact: ContactModel) -> ContactSummary:
    primary_email = _primary_method_value(contact.methods, "email")
    primary_phone = _primary_method_value(contact.methods, "phone")

    return ContactSummary(
        id=contact.id,
        handle=contact.handle,
        display_name=contact.display_name,
        nickname=contact.nickname,
        company=contact.company,
        title=contact.title,
        primary_email=primary_email,
        primary_phone=primary_phone,
    )


def contact_to_detail(contact: ContactModel) -> ContactDetail:
    summary = contact_to_summary(contact)
    return ContactDetail(
        **summary.model_dump(),
        linked_user_id=contact.linked_user_id,
        handle_source=contact.handle_source,
        notes=contact.notes,
        methods=[
            ContactMethodSummary(
                id=method.id,
                type=method.type,  # type: ignore[arg-type]
                label=method.label,
                value=method.value,
                is_primary=method.is_primary,
            )
            for method in contact.methods
        ],
        aliases=[alias.alias for alias in contact.aliases],
    )


def normalize_text(value: str | None) -> str:
    return value.strip().lower() if value else ""


def normalize_method_value(method_type: str, value: str) -> str:
    normalized = value.strip()
    if method_type == "email":
        return normalized.lower()
    if method_type == "phone":
        return "".join(char for char in normalized if char.isdigit() or char == "+")
    return normalized.lower()


def _primary_method_value(methods: list[ContactMethodModel], method_type: str) -> str | None:
    typed_methods = [method for method in methods if method.type == method_type]
    primary = next((method for method in typed_methods if method.is_primary), None)
    fallback = typed_methods[0] if typed_methods else None
    return (primary or fallback).value if (primary or fallback) else None
