"""Demo dataset definitions for API / CLI integration tests."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DemoContactSpec:
    display_name: str
    handle: str
    email: str | None = None
    phone: str | None = None
    alias: str | None = None


@dataclass(frozen=True)
class DemoReminderSpec:
    title: str
    due_at: str
    notes: str | None = None
    contact_handle: str | None = None


@dataclass(frozen=True)
class DemoCalendarSpec:
    title: str
    start_at: str
    end_at: str
    location: str | None = None


def demo_contacts(suffix: str) -> list[DemoContactSpec]:
    return [
        DemoContactSpec(
            display_name="张三",
            handle=f"zhangsan{suffix}",
            email="zhangsan@example.com",
            phone="13800000001",
        ),
        DemoContactSpec(
            display_name="李四",
            handle=f"lisi{suffix}",
            phone="13900000002",
        ),
        DemoContactSpec(
            display_name="王总",
            handle=f"wangzong{suffix}",
            email="wang@corp.example.com",
            alias="客户王总",
        ),
    ]


def demo_reminders(suffix: str) -> list[DemoReminderSpec]:
    wang_handle = f"wangzong{suffix}"
    return [
        DemoReminderSpec(
            title="去图书馆取书",
            due_at="2026-05-28T10:00:00+08:00",
            notes="借阅证在钱包里",
        ),
        DemoReminderSpec(
            title="还信用卡账单",
            due_at="2026-05-30T18:00:00+08:00",
            notes="招商银行",
        ),
        DemoReminderSpec(
            title="给王总发报价确认邮件",
            due_at="2026-05-24T10:00:00+08:00",
            contact_handle=wang_handle,
        ),
    ]


def demo_calendar_events() -> list[DemoCalendarSpec]:
    return [
        DemoCalendarSpec(
            title="团队周会",
            start_at="2026-05-26T09:30:00+08:00",
            end_at="2026-05-26T10:00:00+08:00",
            location="腾讯会议",
        ),
        DemoCalendarSpec(
            title="牙医复诊",
            start_at="2026-05-29T14:00:00+08:00",
            end_at="2026-05-29T15:00:00+08:00",
            location="朝阳门诊",
        ),
    ]
