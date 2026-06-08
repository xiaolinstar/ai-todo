from datetime import datetime
import re
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
    ReminderListResult,
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

    def create(self, input_data: CreateReminderInput) -> tuple[ReminderSummary, bool]:
        title = input_data.title.strip()

        if not title:
            raise ValueError("Reminder title is required.")

        source = _clean_source(input_data.source)
        external_id = _clean_external_id(input_data.external_id)
        if external_id and not source:
            raise ValueError("source is required when externalId is provided.")
        if input_data.source_meta is not None and not isinstance(input_data.source_meta, dict):
            raise ValueError("sourceMeta must be a JSON object.")

        if source and external_id:
            existing = self._repository.find_by_source(source=source, external_id=external_id)
            if existing is not None:
                return self._summary(existing), False

        now = now_utc()
        reminder = ReminderModel(
            id=f"rem_{uuid4().hex[:12]}",
            user_id=self._user_id,
            title=title,
            status="pending",
            due_at=_clean_optional(input_data.due_at),
            remind_at=_clean_optional(input_data.remind_at),
            notes=_clean_optional(input_data.notes),
            source=source,
            external_id=external_id,
            source_meta=input_data.source_meta,
            created_at=now,
            updated_at=now,
        )

        saved = self._repository.add(reminder)
        contacts = (
            self._links.replace_reminder_contacts(saved.id, input_data.contact_ids)
            if input_data.contact_ids
            else []
        )
        return reminder_to_summary(saved, contacts=contacts), True

    def find_by_source(self, *, source: str, external_id: str) -> ReminderSummary:
        cleaned_source = _clean_source(source)
        cleaned_external_id = _clean_external_id(external_id)
        if not cleaned_source or not cleaned_external_id:
            raise ValueError("source and externalId are required.")
        reminder = self._repository.find_by_source(
            source=cleaned_source,
            external_id=cleaned_external_id,
        )
        if reminder is None:
            raise ReminderNotFoundError(f"{cleaned_source}:{cleaned_external_id}")
        return self._summary(reminder)

    def get(self, reminder_id: str) -> ReminderSummary:
        reminder = self._require(reminder_id)
        contacts = self._links.summaries_for_reminder(reminder.id)
        return reminder_to_summary(reminder, contacts=contacts)

    def list_reminders(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = 50,
        cursor: str | None = None,
        sort: str = "created_at",
    ) -> ReminderListResult:
        cleaned_source = _clean_source(source)
        if from_date or to_date:
            return self._list_reminders_in_due_range(
                status=status,
                source=cleaned_source,
                from_date=from_date,
                to_date=to_date,
                limit=limit or 50,
            )

        if sort in {"due_at", "completed_at"}:
            return self._list_reminders_sorted(
                status=status,
                source=cleaned_source,
                sort=sort,
                limit=limit,
            )

        page_limit = limit if limit is not None else 50
        page = self._repository.list_page(
            status=status,
            source=cleaned_source,
            limit=page_limit,
            cursor=cursor,
        )
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in page.items])
        items = [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in page.items
        ]
        return ReminderListResult(
            items=items,
            total_count=page.total_count,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
        )

    def _list_reminders_sorted(
        self,
        *,
        status: str | None,
        source: str | None,
        sort: str,
        limit: int | None,
    ) -> ReminderListResult:
        reminders = self._repository.list_all_sorted(
            status=status,
            source=source,
            sort=sort,
            limit=limit,
        )
        total_count = self._repository.count_active(status=status, source=source)
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in reminders])
        items = [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in reminders
        ]
        return ReminderListResult(
            items=items,
            total_count=total_count,
            next_cursor=None,
            has_more=limit is not None and total_count > len(items),
        )

    def _list_reminders_in_due_range(
        self,
        *,
        status: str | None,
        source: str | None,
        from_date: str | None,
        to_date: str | None,
        limit: int,
    ) -> ReminderListResult:
        filtered: list[ReminderModel] = []
        for reminder in self._repository.list_all_active():
            if status and reminder.status != status:
                continue
            if source and reminder.source != source:
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
        items = [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in limited
        ]
        return ReminderListResult(
            items=items,
            total_count=len(filtered),
            next_cursor=None,
            has_more=len(filtered) > limit,
        )

    def list_today(self) -> ReminderListResult:
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
        items = [
            reminder_to_summary(reminder, contacts=contact_map.get(reminder.id, []))
            for reminder in visible
        ]
        return ReminderListResult(
            items=items,
            total_count=len(items),
            next_cursor=None,
            has_more=False,
        )

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


_SOURCE_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$")


def _clean_source(value: str | None) -> str | None:
    cleaned = _clean_optional(value)
    if cleaned is None:
        return None
    if not _SOURCE_PATTERN.fullmatch(cleaned):
        raise ValueError("source must be 1-64 chars: letters, numbers, _, ., :, or -.")
    return cleaned


def _clean_external_id(value: str | None) -> str | None:
    cleaned = _clean_optional(value)
    if cleaned is None:
        return None
    if len(cleaned) > 255:
        raise ValueError("externalId must be 255 characters or fewer.")
    return cleaned


def _parse_completed_at(value: str | None, timezone: str) -> datetime:
    if not value:
        return now_utc()

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(timezone))
    return parsed.astimezone(ZoneInfo("UTC"))
