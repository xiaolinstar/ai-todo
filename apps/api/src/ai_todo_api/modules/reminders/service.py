from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from ai_todo_api.common.reminder_dates import (
    is_reminder_in_due_range,
    is_reminder_visible_today,
)
from ai_todo_api.common.time import now_utc, today_in_timezone
from ai_todo_api.db.models import ReminderModel
from ai_todo_api.modules.contacts.links import ContactLinkService
from ai_todo_api.modules.reminders.repository import ReminderRepository, reminder_to_summary
from ai_todo_api.modules.reminders.schemas import (
    CompleteReminderInput,
    CreateReminderInput,
    ReminderSummary,
    RescheduleReminderInput,
    UpdateReminderInput,
)


class ReminderNotFoundError(Exception):
    pass


class ReminderService:
    def __init__(
        self,
        repository: ReminderRepository,
        user_id: str,
        timezone: str,
        links: ContactLinkService,
    ) -> None:
        self._repository = repository
        self._user_id = user_id
        self._timezone = timezone
        self._links = links

    def create(self, input_data: CreateReminderInput) -> ReminderSummary:
        title = input_data.title.strip()

        if not title:
            raise ValueError("Reminder title is required.")

        now = now_utc()
        reminder = ReminderModel(
            id=f"rem_{uuid4().hex[:12]}",
            user_id=self._user_id,
            title=title,
            status="pending",
            due_at=_clean_optional(input_data.due_at),
            remind_at=_clean_optional(input_data.remind_at),
            notes=_clean_optional(input_data.notes),
            created_at=now,
            updated_at=now,
        )

        saved = self._repository.add(reminder)
        contacts = (
            self._links.replace_reminder_contacts(saved.id, input_data.contact_ids)
            if input_data.contact_ids
            else []
        )
        return reminder_to_summary(saved, contacts=contacts)

    def get(self, reminder_id: str) -> ReminderSummary:
        reminder = self._require(reminder_id)
        contacts = self._links.summaries_for_reminder(reminder.id)
        return reminder_to_summary(reminder, contacts=contacts)

    def list_reminders(
        self,
        *,
        status: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int = 50,
    ) -> list[ReminderSummary]:
        reminders = self._repository.list_active(limit=limit)
        filtered: list[ReminderModel] = []

        for reminder in reminders:
            if status and reminder.status != status:
                continue
            if not is_reminder_in_due_range(
                due_at=reminder.due_at,
                timezone=self._timezone,
                from_date=from_date,
                to_date=to_date,
            ):
                continue
            filtered.append(reminder)

        limited = filtered[:limit]
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in limited])
        return [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in limited
        ]

    def list_today(self) -> list[ReminderSummary]:
        today = today_in_timezone(self._timezone)
        reminders = self._repository.list_active(limit=200)
        visible = [
            reminder
            for reminder in reminders
            if is_reminder_visible_today(
                due_at=reminder.due_at,
                status=reminder.status,
                timezone=self._timezone,
                today=today,
            )
        ]
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in visible])
        return [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in visible
        ]

    def complete(self, reminder_id: str, input_data: CompleteReminderInput | None = None) -> ReminderSummary:
        reminder = self._require(reminder_id)
        completed_at = _parse_completed_at(input_data.completed_at if input_data else None, self._timezone)
        reminder.status = "completed"
        reminder.completed_at = completed_at
        reminder.updated_at = completed_at
        return self._summary(self._repository.save(reminder))

    def update(self, reminder_id: str, input_data: UpdateReminderInput) -> ReminderSummary:
        reminder = self._require(reminder_id)
        updates = input_data.model_dump(exclude_unset=True)

        if not updates:
            raise ValueError("At least one field is required to update a reminder.")

        contact_ids = updates.pop("contact_ids", None)

        if "title" in updates:
            title = (updates["title"] or "").strip()
            if not title:
                raise ValueError("Reminder title cannot be empty.")
            reminder.title = title

        if "notes" in updates:
            reminder.notes = _clean_optional(updates["notes"])

        if "status" in updates:
            reminder.status = updates["status"]
            if updates["status"] == "completed" and reminder.completed_at is None:
                reminder.completed_at = now_utc()
            if updates["status"] == "pending":
                reminder.completed_at = None

        if "due_at" in updates:
            reminder.due_at = _clean_optional(updates["due_at"])

        if "remind_at" in updates:
            reminder.remind_at = _clean_optional(updates["remind_at"])

        reminder.updated_at = now_utc()
        saved = self._repository.save(reminder)

        if contact_ids is not None:
            contacts = self._links.replace_reminder_contacts(saved.id, contact_ids)
            return reminder_to_summary(saved, contacts=contacts)

        return self._summary(saved)

    def reschedule(self, reminder_id: str, input_data: RescheduleReminderInput) -> ReminderSummary:
        due_at = _clean_optional(input_data.due_at)
        remind_at = _clean_optional(input_data.remind_at)

        if due_at is None and remind_at is None:
            raise ValueError("At least one of due_at or remind_at is required to reschedule.")

        reminder = self._require(reminder_id)

        if due_at is not None:
            reminder.due_at = due_at
        if remind_at is not None:
            reminder.remind_at = remind_at

        if reminder.status == "completed":
            reminder.status = "pending"
            reminder.completed_at = None

        reminder.updated_at = now_utc()
        return self._summary(self._repository.save(reminder))

    def delete(self, reminder_id: str) -> str:
        reminder = self._require(reminder_id)
        now = now_utc()
        reminder.deleted_at = now
        reminder.updated_at = now
        self._repository.save(reminder)
        return reminder.id

    def _summary(self, reminder: ReminderModel) -> ReminderSummary:
        contacts = self._links.summaries_for_reminder(reminder.id)
        return reminder_to_summary(reminder, contacts=contacts)

    def _require(self, reminder_id: str) -> ReminderModel:
        reminder = self._repository.get(reminder_id)
        if reminder is None:
            raise ReminderNotFoundError(reminder_id)
        return reminder


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _parse_completed_at(value: str | None, timezone: str) -> datetime:
    if not value:
        return now_utc()

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(timezone))
    return parsed.astimezone(ZoneInfo("UTC"))
