from typing import Literal

from ai_todo_api.modules.contacts.schemas import ContactSummary
from ai_todo_api.schemas import CamelModel


WechatNotifyStatus = Literal["none", "pending", "sending", "sent", "failed", "no_quota", "skipped"]


class CalendarEventSummary(CamelModel):
    id: str
    title: str
    start_at: str
    end_at: str | None = None
    timezone: str
    location: str | None = None
    description: str | None = None
    wechat_notify_requested: bool = False
    wechat_notify_status: WechatNotifyStatus = "none"
    contacts: list[ContactSummary] = []


class CreateCalendarEventInput(CamelModel):
    title: str
    start_at: str
    end_at: str | None = None
    timezone: str | None = None
    location: str | None = None
    description: str | None = None
    wechat_notify_requested: bool | None = None
    contact_ids: list[str] = []


class CreateCalendarEventResult(CamelModel):
    calendar_event: CalendarEventSummary


class CalendarEventListResult(CamelModel):
    items: list[CalendarEventSummary]
    total_count: int
    next_cursor: str | None = None
    has_more: bool = False


class CalendarEventDetailResult(CamelModel):
    calendar_event: CalendarEventSummary


class UpdateCalendarEventInput(CamelModel):
    title: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    timezone: str | None = None
    location: str | None = None
    description: str | None = None
    wechat_notify_requested: bool | None = None
    contact_ids: list[str] | None = None


class UpdateCalendarEventResult(CamelModel):
    calendar_event: CalendarEventSummary


class DeleteCalendarEventResult(CamelModel):
    id: str
    deleted: bool = True
