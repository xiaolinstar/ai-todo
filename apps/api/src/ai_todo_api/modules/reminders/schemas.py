from typing import Literal

from ai_todo_api.modules.contacts.schemas import ContactSummary
from ai_todo_api.schemas import CamelModel


ReminderStatus = Literal["pending", "completed", "cancelled"]


class ReminderSummary(CamelModel):
    id: str
    title: str
    status: ReminderStatus
    notes: str | None = None
    due_at: str | None = None
    remind_at: str | None = None
    completed_at: str | None = None
    contacts: list[ContactSummary] = []


class CreateReminderInput(CamelModel):
    title: str
    notes: str | None = None
    due_at: str | None = None
    remind_at: str | None = None
    contact_ids: list[str] = []


class CreateReminderResult(CamelModel):
    reminder: ReminderSummary


class CompleteReminderResult(CamelModel):
    reminder: ReminderSummary


class ReminderListResult(CamelModel):
    items: list[ReminderSummary]


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
