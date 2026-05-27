"""Verify demo dataset seeding through the HTTP API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers.demo_seed import assert_demo_dataset_present, seed_demo_dataset


def test_api_seeds_demo_contacts_reminders_and_calendar(
    client: TestClient, demo_suffix: str
) -> None:
    created = seed_demo_dataset(client, demo_suffix)

    assert len(created["contacts"]) == 3
    assert len(created["reminders"]) == 3
    assert len(created["calendar_events"]) == 2

    assert_demo_dataset_present(client, demo_suffix)

    today = client.get("/v1/today")
    assert today.status_code == 200
    body = today.json()["data"]
    assert isinstance(body["reminders"], list)
    assert isinstance(body["calendarEvents"], list)

    calendar_today = client.get("/v1/calendar/today")
    assert calendar_today.status_code == 200
    assert isinstance(calendar_today.json()["data"]["items"], list)
