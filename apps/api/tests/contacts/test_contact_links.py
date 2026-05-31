from typing import TypedDict

from fastapi.testclient import TestClient


class CreatedContact(TypedDict):
    id: str
    handle: str


def _create_contact(
    client: TestClient,
    *,
    name: str = "小明",
    email: str = "xiaoming@example.com",
    handle: str | None = None,
) -> CreatedContact:
    payload = {
        "displayName": name,
        "methods": [{"type": "email", "value": email, "isPrimary": True}],
    }
    if handle:
        payload["handle"] = handle

    response = client.post(
        "/v1/contacts",
        json=payload,
    )
    assert response.status_code == 201
    contact = response.json()["data"]["contact"]
    return {"id": contact["id"], "handle": contact["handle"]}


def test_reminder_create_with_contact_and_today_includes_contacts(client: TestClient) -> None:
    contact = _create_contact(client)

    create_response = client.post(
        "/v1/reminders",
        json={
            "title": "联系小明完成作业",
            "dueAt": "2026-05-20T18:00:00+08:00",
            "contactIds": [contact["id"]],
        },
    )
    assert create_response.status_code == 201
    reminder = create_response.json()["data"]["reminder"]
    assert reminder["contacts"][0]["id"] == contact["id"]
    assert reminder["contacts"][0]["displayName"] == "小明"
    assert reminder["contacts"][0]["primaryEmail"] == "xiaoming@example.com"

    today_response = client.get("/v1/today")
    assert today_response.status_code == 200
    today_reminder = next(
        item for item in today_response.json()["data"]["reminders"] if item["id"] == reminder["id"]
    )
    assert today_reminder["contacts"][0]["id"] == contact["id"]


def test_reminder_create_accepts_contact_handle(client: TestClient) -> None:
    contact = _create_contact(client, name="邢小林", handle="xingxiaolinlink")

    create_response = client.post(
        "/v1/reminders",
        json={
            "title": "给邢小林发邮件",
            "contactIds": [contact["handle"]],
        },
    )

    assert create_response.status_code == 201
    linked = create_response.json()["data"]["reminder"]["contacts"][0]
    assert linked["id"] == contact["id"]
    assert linked["handle"] == contact["handle"]


def test_reminder_update_replaces_contacts(client: TestClient) -> None:
    first = _create_contact(client, name="小明", email="a@example.com")
    second = _create_contact(client, name="小红", email="b@example.com", handle="xiaohong")

    create_response = client.post(
        "/v1/reminders",
        json={"title": "跟进作业", "contactIds": [first["id"]]},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    update_response = client.patch(
        f"/v1/reminders/{reminder_id}",
        json={"contactIds": [second["handle"]]},
    )
    assert update_response.status_code == 200
    contacts = update_response.json()["data"]["reminder"]["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["id"] == second["id"]
    assert contacts[0]["displayName"] == "小红"


def test_reminder_create_with_unknown_contact_returns_404(client: TestClient) -> None:
    response = client.post(
        "/v1/reminders",
        json={"title": "无效联系人", "contactIds": ["ct_missing"]},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CONTACT_NOT_FOUND"


def test_calendar_event_with_contact(client: TestClient) -> None:
    contact = _create_contact(client, name="王总", email="wang@example.com", handle="wangzong")

    response = client.post(
        "/v1/calendar/events",
        json={
            "title": "与王总开会",
            "startAt": "2026-05-21T10:00:00+08:00",
            "contactIds": [contact["handle"]],
        },
    )
    assert response.status_code == 201
    event = response.json()["data"]["calendarEvent"]
    assert event["contacts"][0]["id"] == contact["id"]
    assert event["contacts"][0]["displayName"] == "王总"


def test_calendar_event_update_accepts_contact_handle(client: TestClient) -> None:
    first = _create_contact(client, name="赵总", email="zhao@example.com", handle="zhaozong")
    second = _create_contact(client, name="李总", email="li@example.com", handle="lizong")

    create_response = client.post(
        "/v1/calendar/events",
        json={
            "title": "客户沟通",
            "startAt": "2026-05-21T10:00:00+08:00",
            "contactIds": [first["id"]],
        },
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]

    update_response = client.patch(
        f"/v1/calendar/events/{event_id}",
        json={"contactIds": [second["handle"]]},
    )

    assert update_response.status_code == 200
    contacts = update_response.json()["data"]["calendarEvent"]["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["id"] == second["id"]
    assert contacts[0]["handle"] == "lizong"
