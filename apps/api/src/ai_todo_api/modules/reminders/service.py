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
from ai_todo_api.modules.reminders.enrichment import reminder_to_enriched_summary, reminders_to_enriched_summaries
from ai_todo_api.modules.reminders.repository import ReminderRepository
from ai_todo_api.modules.reminders.schemas import (
    AddTrackEntryInput,
    CompleteReminderInput,
    CreateReminderInput,
    ReminderListResult,
    ReminderSummary,
    RescheduleReminderInput,
    UpdateReminderInput,
)
from ai_todo_api.modules.reminders.track_repository import TrackEntryRepository
from ai_todo_api.modules.notifications.notify_fields import load_wechat_notify_status_map
from ai_todo_api.modules.notifications.service import (
    TARGET_TYPE_REMINDER,
    TEMPLATE_KEY_REMINDER_DUE,
)
from ai_todo_api.modules.tags.repository import TagRepository


class ReminderNotFoundError(Exception):
    pass


VALID_REMINDER_STATUSES = frozenset({"pending", "in_progress", "completed", "cancelled"})
VALID_SORT_VALUES = frozenset({"created_at", "due_at", "completed_at", "updated_at"})


def _validate_status_filter(status: str | None) -> None:
    if status and status not in VALID_REMINDER_STATUSES:
        raise ValueError(
            "status must be one of: pending, in_progress, completed, cancelled"
        )


def _validate_sort(sort: str) -> None:
    if sort not in VALID_SORT_VALUES:
        raise ValueError("sort must be one of: created_at, due_at, completed_at, updated_at")


def _apply_status(reminder: ReminderModel, status: str) -> None:
    if status not in VALID_REMINDER_STATUSES:
        raise ValueError(
            "status must be one of: pending, in_progress, completed, cancelled"
        )
    reminder.status = status
    if status == "completed":
        if reminder.completed_at is None:
            reminder.completed_at = now_utc()
    else:
        reminder.completed_at = None


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

    @property
    def _session(self):
        return self._repository.session

    def _tags(self) -> TagRepository:
        return TagRepository(self._session, self._user_id)

    def _tracks(self) -> TrackEntryRepository:
        return TrackEntryRepository(self._session, self._user_id)

    def create(
        self,
        input_data: CreateReminderInput,
        *,
        wechat_notify_requested: bool = False,
    ) -> tuple[ReminderSummary, bool]:
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
            wechat_notify_requested=wechat_notify_requested,
            created_at=now,
            updated_at=now,
        )

        saved = self._repository.add(reminder)
        contacts = (
            self._links.replace_reminder_contacts(saved.id, input_data.contact_ids)
            if input_data.contact_ids
            else []
        )
        if input_data.tag_names:
            self._tags().replace_reminder_tags(saved.id, input_data.tag_names)
            self._session.commit()
            self._session.refresh(saved)

        return self._summary(saved, contacts=contacts), True

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
        return self._summary(reminder)

    def list_reminders(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        query: str | None = None,
        tag: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = 50,
        cursor: str | None = None,
        sort: str = "created_at",
    ) -> ReminderListResult:
        _validate_status_filter(status)
        _validate_sort(sort)
        cleaned_source = _clean_source(source)
        cleaned_query = _clean_optional(query)
        cleaned_tag = _clean_optional(tag)

        if from_date or to_date:
            return self._list_reminders_in_due_range(
                status=status,
                source=cleaned_source,
                query=cleaned_query,
                tag=cleaned_tag,
                from_date=from_date,
                to_date=to_date,
                limit=limit or 50,
            )

        if sort in {"due_at", "completed_at", "updated_at"} or cleaned_query or cleaned_tag:
            effective_sort = "updated_at" if cleaned_query and sort == "created_at" else sort
            return self._list_reminders_sorted(
                status=status,
                source=cleaned_source,
                query=cleaned_query,
                tag=cleaned_tag,
                sort=effective_sort,
                limit=limit,
            )

        page_limit = limit if limit is not None else 50
        page = self._repository.list_page(
            status=status,
            source=cleaned_source,
            query=cleaned_query,
            tag=cleaned_tag,
            limit=page_limit,
            cursor=cursor,
            sort=sort,
        )
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in page.items])
        items = reminders_to_enriched_summaries(
            self._session,
            self._user_id,
            page.items,
            contact_map,
        )
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
        query: str | None,
        tag: str | None,
        sort: str,
        limit: int | None,
    ) -> ReminderListResult:
        reminders = self._repository.list_all_sorted(
            status=status,
            source=source,
            query=query,
            tag=tag,
            sort=sort,
            limit=limit,
        )
        total_count = self._repository.count_active(
            status=status,
            source=source,
            query=query,
            tag=tag,
        )
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in reminders])
        items = reminders_to_enriched_summaries(
            self._session,
            self._user_id,
            reminders,
            contact_map,
        )
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
        query: str | None,
        tag: str | None,
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

        if query or tag:
            matched_ids = {
                item.id
                for item in self._repository.list_all_sorted(
                    status=status,
                    source=source,
                    query=query,
                    tag=tag,
                    sort="updated_at",
                )
            }
            filtered = [reminder for reminder in filtered if reminder.id in matched_ids]

        limited = filtered[:limit]
        contact_map = self._links.summaries_for_reminders([reminder.id for reminder in limited])
        items = reminders_to_enriched_summaries(
            self._session,
            self._user_id,
            limited,
            contact_map,
        )
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
        items = reminders_to_enriched_summaries(
            self._session,
            self._user_id,
            visible,
            contact_map,
        )
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
        tag_names = updates.pop("tag_names", None)

        if "title" in updates:
            title = (updates["title"] or "").strip()
            if not title:
                raise ValueError("Reminder title cannot be empty.")
            reminder.title = title

        if "notes" in updates:
            reminder.notes = _clean_optional(updates["notes"])

        if "status" in updates:
            _apply_status(reminder, updates["status"])

        if "due_at" in updates:
            reminder.due_at = _clean_optional(updates["due_at"])

        if "remind_at" in updates:
            reminder.remind_at = _clean_optional(updates["remind_at"])

        if "wechat_notify_requested" in updates:
            reminder.wechat_notify_requested = bool(updates["wechat_notify_requested"])

        reminder.updated_at = now_utc()
        saved = self._repository.save(reminder)

        if tag_names is not None:
            self._tags().replace_reminder_tags(saved.id, tag_names)
            self._session.commit()
            self._session.refresh(saved)

        if contact_ids is not None:
            contacts = self._links.replace_reminder_contacts(saved.id, contact_ids)
            return self._summary(saved, contacts=contacts)

        return self._summary(saved)

    def add_track_entry(self, reminder_id: str, input_data: AddTrackEntryInput) -> ReminderSummary:
        reminder = self._require(reminder_id)
        self._tracks().add(
            reminder_id=reminder.id,
            text=input_data.text,
            timezone=self._timezone,
        )
        reminder.updated_at = now_utc()
        saved = self._repository.save(reminder)
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

    def _summary(self, reminder: ReminderModel, *, contacts: list | None = None) -> ReminderSummary:
        if contacts is None:
            contacts = self._links.summaries_for_reminder(reminder.id)
        status_map = load_wechat_notify_status_map(
            self._session,
            self._user_id,
            target_type=TARGET_TYPE_REMINDER,
            template_key=TEMPLATE_KEY_REMINDER_DUE,
            target_ids=[reminder.id],
        )
        return reminder_to_enriched_summary(
            self._session,
            self._user_id,
            reminder,
            contacts=contacts,
            wechat_notify_status=status_map.get(reminder.id, "none"),
        )

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
