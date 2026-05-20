from ai_todo_api.modules.calendar.schemas import CalendarEventSummary
from ai_todo_api.modules.reminders.schemas import ReminderSummary
from ai_todo_api.schemas import CamelModel


class TodayResult(CamelModel):
    date: str
    timezone: str
    reminders: list[ReminderSummary]
    calendar_events: list[CalendarEventSummary] = []
