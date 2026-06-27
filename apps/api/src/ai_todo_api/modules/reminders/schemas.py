from typing import Any, Literal

from ai_todo_api.modules.contacts.schemas import ContactSummary
from ai_todo_api.schemas import CamelModel


ReminderStatus = Literal["pending", "in_progress", "completed", "cancelled"]
WechatNotifyStatus = Literal["none", "pending", "sent", "failed", "no_quota", "skipped"]


class ReminderSummary(CamelModel):
    id: str
    title: str
    status: ReminderStatus
    notes: str | None = None
    due_at: str | None = None
    remind_at: str | None = None
    source: str | None = None
    external_id: str | None = None
    source_meta: dict[str, Any] | None = None
    completed_at: str | None = None
    wechat_notify_requested: bool = False
    wechat_notify_status: WechatNotifyStatus = "none"
    contacts: list[ContactSummary] = []


class CreateReminderInput(CamelModel):
    title: str
    notes: str | None = None
    due_at: str | None = None
    remind_at: str | None = None
    source: str | None = None
    external_id: str | None = None
    source_meta: dict[str, Any] | None = None
    wechat_notify_requested: bool | None = None
    contact_ids: list[str] = []


class CreateReminderResult(CamelModel):
    reminder: ReminderSummary
    created: bool = True


class CompleteReminderResult(CamelModel):
    reminder: ReminderSummary


class ReminderListResult(CamelModel):
    items: list[ReminderSummary]
    total_count: int
    next_cursor: str | None = None
    has_more: bool = False


class ReminderDetailResult(CamelModel):
    reminder: ReminderSummary


class CompleteReminderInput(CamelModel):
    completed_at: str | None = None


class UpdateReminderInput(CamelModel):
    title: str | None = None
    notes: str | None = None
    status: ReminderStatus | None = None
    due_at: str | None = None
    remind_at: str | None = None
    wechat_notify_requested: bool | None = None
    contact_ids: list[str] | None = None


class RescheduleReminderInput(CamelModel):
    due_at: str | None = None
    remind_at: str | None = None


class UpdateReminderResult(CamelModel):
    reminder: ReminderSummary


class RescheduleReminderResult(CamelModel):
    reminder: ReminderSummary


class DeleteReminderResult(CamelModel):
    id: str
    deleted: bool = True
