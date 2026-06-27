from fastapi.testclient import TestClient

from ai_todo_api.common.time import today_in_timezone
from ai_todo_api.config import settings


def test_calendar_crud_and_today(client: TestClient) -> None:
    today = today_in_timezone(settings.timezone)
    start_at = f"{today}T14:00:00+08:00"
    end_at = f"{today}T15:00:00+08:00"

    create_response = client.post(
        "/v1/calendar/events",
        json={
            "title": "产品评审",
            "startAt": start_at,
            "endAt": end_at,
            "location": "会议室 A",
        },
    )
    assert create_response.status_code == 201
    event = create_response.json()["data"]["calendarEvent"]
    assert event["title"] == "产品评审"
    assert event["startAt"] == start_at

    list_today = client.get("/v1/calendar/today")
    assert list_today.status_code == 200
    today_ids = {item["id"] for item in list_today.json()["data"]["items"]}
    assert event["id"] in today_ids

    aggregate = client.get("/v1/today")
    assert aggregate.status_code == 200
    aggregate_events = aggregate.json()["data"]["calendarEvents"]
    assert any(item["id"] == event["id"] for item in aggregate_events)

    list_range = client.get("/v1/calendar/events", params={"from": today, "to": today})
    range_ids = {item["id"] for item in list_range.json()["data"]["items"]}
    assert event["id"] in range_ids

    patch_response = client.patch(
        f"/v1/calendar/events/{event['id']}",
        json={"title": "产品评审（更新）", "location": "线上"},
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()["data"]["calendarEvent"]
    assert patched["title"] == "产品评审（更新）"
    assert patched["location"] == "线上"

    delete_response = client.delete(f"/v1/calendar/events/{event['id']}")
    assert delete_response.status_code == 200

    after_delete = client.get(f"/v1/calendar/events/{event['id']}")
    assert after_delete.status_code == 404

    today_after_delete = client.get("/v1/calendar/today")
    assert event["id"] not in {item["id"] for item in today_after_delete.json()["data"]["items"]}


def test_calendar_rejects_invalid_time_range(client: TestClient) -> None:
    response = client.post(
        "/v1/calendar/events",
        json={
            "title": "无效时段",
            "startAt": "2026-05-25T15:00:00+08:00",
            "endAt": "2026-05-25T14:00:00+08:00",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VAL_INVALID_INPUT"


def test_calendar_list_filters_by_date_range(client: TestClient) -> None:
    inside = client.post(
        "/v1/calendar/events",
        json={
            "title": "范围内会议",
            "startAt": "2026-05-26T09:30:00+08:00",
            "endAt": "2026-05-26T10:00:00+08:00",
            "location": "线上",
        },
    )
    assert inside.status_code == 201
    inside_id = inside.json()["data"]["calendarEvent"]["id"]

    outside = client.post(
        "/v1/calendar/events",
        json={
            "title": "范围外会议",
            "startAt": "2026-06-02T09:30:00+08:00",
            "endAt": "2026-06-02T10:00:00+08:00",
        },
    )
    assert outside.status_code == 201

    listed = client.get(
        "/v1/calendar/events",
        params={"from": "2026-05-26", "to": "2026-05-27"},
    )
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()["data"]["items"]}
    assert inside_id in ids
    assert outside.json()["data"]["calendarEvent"]["id"] not in ids


def test_calendar_show_returns_detail(client: TestClient) -> None:
    create = client.post(
        "/v1/calendar/events",
        json={
            "title": "CLI 联调日程",
            "startAt": "2026-05-29T14:00:00+08:00",
            "endAt": "2026-05-29T15:00:00+08:00",
            "location": "测试地点",
        },
    )
    assert create.status_code == 201
    event_id = create.json()["data"]["calendarEvent"]["id"]

    detail = client.get(f"/v1/calendar/events/{event_id}")
    assert detail.status_code == 200
    event = detail.json()["data"]["calendarEvent"]
    assert event["title"] == "CLI 联调日程"
    assert event["location"] == "测试地点"
