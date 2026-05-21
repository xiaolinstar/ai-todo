from uuid import uuid4

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ContactAliasModel, ContactMethodModel, ContactModel
from ai_todo_api.modules.contacts.repository import (
    ContactRepository,
    contact_to_detail,
    contact_to_summary,
    normalize_method_value,
    normalize_text,
)
from ai_todo_api.modules.contacts.schemas import (
    ContactDetail,
    ContactSummary,
    CreateContactInput,
    UpdateContactInput,
)


class ContactNotFoundError(Exception):
    pass


class ContactService:
    def __init__(self, repository: ContactRepository, user_id: str) -> None:
        self._repository = repository
        self._user_id = user_id

    def create(self, input_data: CreateContactInput) -> ContactDetail:
        display_name = input_data.display_name.strip()
        if not display_name:
            raise ValueError("Contact display name is required.")

        now = now_utc()
        contact = ContactModel(
            id=f"contact_{uuid4().hex[:12]}",
            user_id=self._user_id,
            display_name=display_name,
            nickname=_clean_optional(input_data.nickname),
            company=_clean_optional(input_data.company),
            title=_clean_optional(input_data.title),
            notes=_clean_optional(input_data.notes),
            source="manual",
            created_at=now,
            updated_at=now,
        )

        methods = input_data.methods
        primary_seen: set[str] = set()
        for method in methods:
            value = method.value.strip()
            if not value:
                continue

            is_primary = method.is_primary or method.type not in primary_seen
            if is_primary:
                primary_seen.add(method.type)

            contact.methods.append(
                ContactMethodModel(
                    id=f"cm_{uuid4().hex[:12]}",
                    user_id=self._user_id,
                    type=method.type,
                    label=_clean_optional(method.label),
                    value=value,
                    normalized_value=normalize_method_value(method.type, value),
                    is_primary=is_primary,
                    created_at=now,
                    updated_at=now,
                )
            )

        alias_values = _unique_aliases([*input_data.aliases, input_data.nickname])
        for alias in alias_values:
            contact.aliases.append(
                ContactAliasModel(
                    id=f"ca_{uuid4().hex[:12]}",
                    user_id=self._user_id,
                    alias=alias,
                    normalized_alias=normalize_text(alias),
                    created_at=now,
                )
            )

        return contact_to_detail(self._repository.add(contact))

    def update(self, contact_id: str, input_data: UpdateContactInput) -> ContactDetail:
        contact = self._repository.get(contact_id)
        if contact is None:
            raise ContactNotFoundError(contact_id)

        updates = input_data.model_dump(exclude_unset=True)
        if not updates:
            raise ValueError("At least one field is required to update a contact.")

        now = now_utc()

        if "display_name" in updates:
            display_name = (updates["display_name"] or "").strip()
            if not display_name:
                raise ValueError("Contact display name cannot be empty.")
            contact.display_name = display_name

        for field in ("nickname", "company", "title", "notes"):
            if field in updates:
                setattr(contact, field, _clean_optional(updates[field]))

        if "methods" in updates:
            contact.methods.clear()
            primary_seen: set[str] = set()
            for method in input_data.methods or []:
                value = method.value.strip()
                if not value:
                    continue
                is_primary = method.is_primary or method.type not in primary_seen
                if is_primary:
                    primary_seen.add(method.type)
                contact.methods.append(
                    ContactMethodModel(
                        id=f"cm_{uuid4().hex[:12]}",
                        user_id=self._user_id,
                        type=method.type,
                        label=_clean_optional(method.label),
                        value=value,
                        normalized_value=normalize_method_value(method.type, value),
                        is_primary=is_primary,
                        created_at=now,
                        updated_at=now,
                    )
                )

        if "aliases" in updates:
            contact.aliases.clear()
            for alias in _unique_aliases(updates["aliases"] or []):
                contact.aliases.append(
                    ContactAliasModel(
                        id=f"ca_{uuid4().hex[:12]}",
                        user_id=self._user_id,
                        alias=alias,
                        normalized_alias=normalize_text(alias),
                        created_at=now,
                    )
                )

        contact.updated_at = now
        return contact_to_detail(self._repository.save(contact))

    def search(self, query: str | None = None, limit: int = 20) -> list[ContactSummary]:
        return [contact_to_summary(contact) for contact in self._repository.search(query, limit)]

    def get(self, contact_id: str) -> ContactDetail:
        contact = self._repository.get(contact_id)
        if contact is None:
            raise ContactNotFoundError(contact_id)
        return contact_to_detail(contact)


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _unique_aliases(values: list[str | None]) -> list[str]:
    aliases: list[str] = []
    seen: set[str] = set()

    for value in values:
        cleaned = _clean_optional(value)
        if not cleaned:
            continue
        normalized = normalize_text(cleaned)
        if normalized in seen:
            continue
        seen.add(normalized)
        aliases.append(cleaned)

    return aliases
