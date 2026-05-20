from ai_todo_api.schemas import CamelModel


class CalendarEventSummary(CamelModel):
    id: str
    title: str
    start_at: str
    end_at: str | None = None
    timezone: str
    location: str | None = None
    description: str | None = None
    contacts: list[object] = []


class CreateCalendarEventInput(CamelModel):
    title: str
    start_at: str
    end_at: str | None = None
    timezone: str | None = None
    location: str | None = None
    description: str | None = None
    contact_ids: list[str] = []


class CreateCalendarEventResult(CamelModel):
    calendar_event: CalendarEventSummary


class CalendarEventListResult(CamelModel):
    items: list[CalendarEventSummary]


class CalendarEventDetailResult(CamelModel):
    calendar_event: CalendarEventSummary


class UpdateCalendarEventInput(CamelModel):
    title: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    timezone: str | None = None
    location: str | None = None
    description: str | None = None


class UpdateCalendarEventResult(CamelModel):
    calendar_event: CalendarEventSummary


class DeleteCalendarEventResult(CamelModel):
    id: str
    deleted: bool = True
