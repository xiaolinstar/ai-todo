from uuid import uuid4

from ai_todo_api.common.event_dates import event_overlaps_date_range, event_visible_on_date
from ai_todo_api.common.reminder_dates import parse_due_at
from ai_todo_api.common.time import now_utc, today_in_timezone
from ai_todo_api.db.models import CalendarEventModel
from ai_todo_api.modules.calendar.repository import CalendarEventRepository, event_to_summary
from ai_todo_api.modules.calendar.schemas import (
    CalendarEventSummary,
    CreateCalendarEventInput,
    UpdateCalendarEventInput,
)


class CalendarEventNotFoundError(Exception):
    pass


class CalendarEventService:
    def __init__(self, repository: CalendarEventRepository, user_id: str, timezone: str) -> None:
        self._repository = repository
        self._user_id = user_id
        self._timezone = timezone

    def create(self, input_data: CreateCalendarEventInput) -> CalendarEventSummary:
        title = input_data.title.strip()
        start_at = _clean_required(input_data.start_at, "start_at")
        end_at = _clean_optional(input_data.end_at)
        event_timezone = _clean_optional(input_data.timezone) or self._timezone

        if not title:
            raise ValueError("Calendar event title is required.")

        _validate_time_range(start_at, end_at, event_timezone)

        now = now_utc()
        event = CalendarEventModel(
            id=f"evt_{uuid4().hex[:12]}",
            user_id=self._user_id,
            title=title,
            description=_clean_optional(input_data.description),
            start_at=start_at,
            end_at=end_at,
            timezone=event_timezone,
            location=_clean_optional(input_data.location),
            source="api",
            created_at=now,
            updated_at=now,
        )

        return event_to_summary(self._repository.add(event))

    def get(self, event_id: str) -> CalendarEventSummary:
        return event_to_summary(self._require(event_id))

    def list_events(
        self,
        *,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int = 50,
    ) -> list[CalendarEventSummary]:
        events = self._repository.list_active(limit=limit)
        filtered = [
            event
            for event in events
            if event_overlaps_date_range(
                start_at=event.start_at,
                end_at=event.end_at,
                timezone=event.timezone,
                from_date=from_date,
                to_date=to_date,
            )
        ]
        return [event_to_summary(event) for event in filtered[:limit]]

    def list_today(self) -> list[CalendarEventSummary]:
        today = today_in_timezone(self._timezone)
        events = self._repository.list_active(limit=200)
        visible = [
            event
            for event in events
            if event_visible_on_date(
                start_at=event.start_at,
                end_at=event.end_at,
                timezone=event.timezone,
                target_date=today,
            )
        ]
        return [event_to_summary(event) for event in visible]

    def update(self, event_id: str, input_data: UpdateCalendarEventInput) -> CalendarEventSummary:
        event = self._require(event_id)
        updates = input_data.model_dump(exclude_unset=True)

        if not updates:
            raise ValueError("At least one field is required to update a calendar event.")

        if "title" in updates:
            title = (updates["title"] or "").strip()
            if not title:
                raise ValueError("Calendar event title cannot be empty.")
            event.title = title

        if "description" in updates:
            event.description = _clean_optional(updates["description"])

        if "location" in updates:
            event.location = _clean_optional(updates["location"])

        if "timezone" in updates and updates["timezone"]:
            event.timezone = updates["timezone"].strip()

        if "start_at" in updates:
            event.start_at = _clean_required(updates["start_at"], "start_at")

        if "end_at" in updates:
            event.end_at = _clean_optional(updates["end_at"])

        _validate_time_range(event.start_at, event.end_at, event.timezone)
        event.updated_at = now_utc()
        return event_to_summary(self._repository.save(event))

    def delete(self, event_id: str) -> str:
        event = self._require(event_id)
        now = now_utc()
        event.deleted_at = now
        event.updated_at = now
        self._repository.save(event)
        return event.id

    def _require(self, event_id: str) -> CalendarEventModel:
        event = self._repository.get(event_id)
        if event is None:
            raise CalendarEventNotFoundError(event_id)
        return event


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _clean_required(value: str | None, field_name: str) -> str:
    cleaned = _clean_optional(value)
    if not cleaned:
        raise ValueError(f"Calendar event {field_name} is required.")
    return cleaned


def _validate_time_range(start_at: str, end_at: str | None, timezone: str) -> None:
    start = parse_due_at(start_at, timezone)
    if not end_at:
        return

    end = parse_due_at(end_at, timezone)
    if end < start:
        raise ValueError("Calendar event end_at must be after start_at.")
