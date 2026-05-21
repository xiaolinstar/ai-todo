from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ai_todo_api.db.models import ContactAliasModel, ContactMethodModel, ContactModel
from ai_todo_api.modules.contacts.schemas import (
    ContactDetail,
    ContactMethodSummary,
    ContactSummary,
)


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

    def get(self, contact_id: str) -> ContactModel | None:
        statement = (
            select(ContactModel)
            .where(
                ContactModel.id == contact_id,
                ContactModel.user_id == self._user_id,
            )
            .options(
                selectinload(ContactModel.methods),
                selectinload(ContactModel.aliases),
            )
        )
        return self._session.scalar(statement)

    def search(self, query: str | None = None, limit: int = 20) -> list[ContactModel]:
        statement = (
            select(ContactModel)
            .where(ContactModel.user_id == self._user_id)
            .options(
                selectinload(ContactModel.methods),
                selectinload(ContactModel.aliases),
            )
        )

        normalized_query = normalize_text(query)
        if normalized_query:
            pattern = f"%{normalized_query}%"
            statement = (
                statement.outerjoin(ContactAliasModel)
                .where(
                    or_(
                        ContactModel.display_name.ilike(pattern),
                        ContactModel.nickname.ilike(pattern),
                        ContactModel.company.ilike(pattern),
                        ContactAliasModel.normalized_alias.ilike(pattern),
                    )
                )
                .distinct()
            )

        return list(self._session.scalars(statement.order_by(ContactModel.created_at).limit(limit)))


def contact_to_summary(contact: ContactModel) -> ContactSummary:
    primary_email = _primary_method_value(contact.methods, "email")
    primary_phone = _primary_method_value(contact.methods, "phone")

    return ContactSummary(
        id=contact.id,
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
