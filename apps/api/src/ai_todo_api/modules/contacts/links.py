from uuid import uuid4

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, selectinload

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import (
    CalendarEventContactModel,
    ContactModel,
    ReminderContactModel,
)
from ai_todo_api.modules.contacts.handles import normalize_handle
from ai_todo_api.modules.contacts.repository import contact_to_summary
from ai_todo_api.modules.contacts.service import ContactNotFoundError
from ai_todo_api.modules.contacts.schemas import ContactSummary


class ContactLinkService:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def validate_contact_ids(self, contact_refs: list[str]) -> list[str]:
        return self.resolve_contact_refs(contact_refs)

    def resolve_contact_refs(self, contact_refs: list[str]) -> list[str]:
        unique_refs = _dedupe(contact_refs)
        if not unique_refs:
            return []

        normalized_handles = [normalize_handle(contact_ref) for contact_ref in unique_refs]
        usable_handles = [handle for handle in normalized_handles if handle]
        contacts = list(
            self._session.scalars(
                select(ContactModel)
                .where(
                    ContactModel.user_id == self._user_id,
                    or_(
                        ContactModel.id.in_(unique_refs),
                        ContactModel.handle.in_(usable_handles),
                    ),
                )
            )
        )
        by_id = {contact.id: contact for contact in contacts}
        by_handle = {contact.handle: contact for contact in contacts}

        result: list[str] = []
        seen_ids: set[str] = set()
        for contact_ref in unique_refs:
            contact = by_id.get(contact_ref) or by_handle.get(normalize_handle(contact_ref))
            if contact is None:
                raise ContactNotFoundError(contact_ref)
            if contact.id in seen_ids:
                continue
            seen_ids.add(contact.id)
            result.append(contact.id)
        return result

    def replace_reminder_contacts(
        self,
        reminder_id: str,
        contact_ids: list[str],
        *,
        role: str = "related",
    ) -> list[ContactSummary]:
        validated = self.validate_contact_ids(contact_ids)
        self._session.execute(
            delete(ReminderContactModel).where(ReminderContactModel.reminder_id == reminder_id)
        )
        now = now_utc()
        for contact_id in validated:
            self._session.add(
                ReminderContactModel(
                    id=f"rc_{uuid4().hex[:12]}",
                    reminder_id=reminder_id,
                    contact_id=contact_id,
                    role=role,
                    created_at=now,
                )
            )
        self._session.commit()
        return self.summaries_for_reminder(reminder_id)

    def replace_calendar_contacts(
        self,
        event_id: str,
        contact_ids: list[str],
        *,
        role: str = "participant",
    ) -> list[ContactSummary]:
        validated = self.validate_contact_ids(contact_ids)
        self._session.execute(
            delete(CalendarEventContactModel).where(
                CalendarEventContactModel.calendar_event_id == event_id
            )
        )
        now = now_utc()
        for contact_id in validated:
            self._session.add(
                CalendarEventContactModel(
                    id=f"cec_{uuid4().hex[:12]}",
                    calendar_event_id=event_id,
                    contact_id=contact_id,
                    role=role,
                    created_at=now,
                )
            )
        self._session.commit()
        return self.summaries_for_calendar_event(event_id)

    def summaries_for_reminder(self, reminder_id: str) -> list[ContactSummary]:
        return self.summaries_for_reminders([reminder_id]).get(reminder_id, [])

    def summaries_for_calendar_event(self, event_id: str) -> list[ContactSummary]:
        return self.summaries_for_calendar_events([event_id]).get(event_id, [])

    def summaries_for_reminders(self, reminder_ids: list[str]) -> dict[str, list[ContactSummary]]:
        if not reminder_ids:
            return {}

        rows = list(
            self._session.scalars(
                select(ReminderContactModel).where(
                    ReminderContactModel.reminder_id.in_(reminder_ids)
                )
            )
        )
        contact_ids = list({row.contact_id for row in rows})
        contacts_by_id = self._load_contacts(contact_ids)

        result: dict[str, list[ContactSummary]] = {reminder_id: [] for reminder_id in reminder_ids}
        for row in rows:
            contact = contacts_by_id.get(row.contact_id)
            if contact is not None:
                result[row.reminder_id].append(contact_to_summary(contact))
        return result

    def summaries_for_calendar_events(self, event_ids: list[str]) -> dict[str, list[ContactSummary]]:
        if not event_ids:
            return {}

        rows = list(
            self._session.scalars(
                select(CalendarEventContactModel).where(
                    CalendarEventContactModel.calendar_event_id.in_(event_ids)
                )
            )
        )
        contact_ids = list({row.contact_id for row in rows})
        contacts_by_id = self._load_contacts(contact_ids)

        result: dict[str, list[ContactSummary]] = {event_id: [] for event_id in event_ids}
        for row in rows:
            contact = contacts_by_id.get(row.contact_id)
            if contact is not None:
                result[row.calendar_event_id].append(contact_to_summary(contact))
        return result

    def _load_contacts(self, contact_ids: list[str]) -> dict[str, ContactModel]:
        if not contact_ids:
            return {}

        contacts = list(
            self._session.scalars(
                select(ContactModel)
                .where(
                    ContactModel.user_id == self._user_id,
                    ContactModel.id.in_(contact_ids),
                )
                .options(
                    selectinload(ContactModel.methods),
                    selectinload(ContactModel.aliases),
                )
            )
        )
        return {contact.id: contact for contact in contacts}


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = value.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result
