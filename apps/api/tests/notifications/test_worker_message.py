from ai_todo_api.modules.notifications.worker import (
    WECHAT_REMINDER_FIELD_DUE,
    WECHAT_REMINDER_FIELD_NOTES,
    WECHAT_REMINDER_FIELD_TITLE,
    _format_wechat_time,
    _truncate,
)


def test_format_wechat_time_from_iso_with_timezone():
    assert _format_wechat_time("2026-06-06T15:30:00+08:00") == "2026年6月6日 15:30"


def test_truncate_thing_field():
    assert _truncate("a" * 25, 20) == "a" * 20


def test_wechat_reminder_field_keys_match_template_15788():
    assert WECHAT_REMINDER_FIELD_TITLE == "thing23"
    assert WECHAT_REMINDER_FIELD_DUE == "time2"
    assert WECHAT_REMINDER_FIELD_NOTES == "thing13"
