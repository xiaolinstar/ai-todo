"""Seed and verify demo datasets via HTTP API (TestClient)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers.demo_data import (
    DemoCalendarSpec,
    DemoContactSpec,
    DemoReminderSpec,
    demo_calendar_events,
    demo_contacts,
    demo_reminders,
)


def seed_contacts(client: TestClient, contacts: list[DemoContactSpec]) -> list[str]:
    created_ids: list[str] = []
    for contact in contacts:
        methods = []
        if contact.email:
            methods.append(
                {"type": "email", "value": contact.email, "label": "work", "isPrimary": True}
            )
        if contact.phone:
            methods.append(
                {"type": "phone", "value": contact.phone, "label": "mobile", "isPrimary": True}
            )
        payload: dict = {
            "displayName": contact.display_name,
            "handle": contact.handle,
            "methods": methods,
        }
        if contact.alias:
            payload["aliases"] = [contact.alias]

        response = client.post("/v1/contacts", json=payload)
        assert response.status_code == 201, response.text
        created_ids.append(response.json()["data"]["contact"]["id"])
    return created_ids


def seed_reminders(client: TestClient, reminders: list[DemoReminderSpec]) -> list[str]:
    created_ids: list[str] = []
    for reminder in reminders:
        payload: dict = {"title": reminder.title, "dueAt": reminder.due_at}
        if reminder.notes:
            payload["notes"] = reminder.notes
        if reminder.contact_handle:
            payload["contactIds"] = [reminder.contact_handle]

        response = client.post("/v1/reminders", json=payload)
        assert response.status_code == 201, response.text
        created_ids.append(response.json()["data"]["reminder"]["id"])
    return created_ids


def seed_calendar_events(client: TestClient, events: list[DemoCalendarSpec]) -> list[str]:
    created_ids: list[str] = []
    for event in events:
        payload: dict = {
            "title": event.title,
            "startAt": event.start_at,
            "endAt": event.end_at,
        }
        if event.location:
            payload["location"] = event.location

        response = client.post("/v1/calendar/events", json=payload)
        assert response.status_code == 201, response.text
        created_ids.append(response.json()["data"]["calendarEvent"]["id"])
    return created_ids


def seed_demo_dataset(client: TestClient, suffix: str) -> dict[str, list[str]]:
    contacts = demo_contacts(suffix)
    reminders = demo_reminders(suffix)
    events = demo_calendar_events()
    return {
        "contacts": seed_contacts(client, contacts),
        "reminders": seed_reminders(client, reminders),
        "calendar_events": seed_calendar_events(client, events),
    }


def assert_demo_dataset_present(client: TestClient, suffix: str) -> None:
    contacts = demo_contacts(suffix)
    reminders = demo_reminders(suffix)
    events = demo_calendar_events()

    for contact in contacts:
        detail = client.get(f"/v1/contacts/{contact.handle}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["data"]["contact"]["handle"] == contact.handle

    list_reminders = client.get("/v1/reminders")
    assert list_reminders.status_code == 200
    titles = {item["title"] for item in list_reminders.json()["data"]["items"]}
    for reminder in reminders:
        assert reminder.title in titles

    list_events = client.get(
        "/v1/calendar/events",
        params={"from": "2026-05-26", "to": "2026-05-29"},
    )
    assert list_events.status_code == 200
    event_titles = {item["title"] for item in list_events.json()["data"]["items"]}
    for event in events:
        assert event.title in event_titles
