"""CLI integration tests: build CLI, talk to live API, seed demo data."""

from __future__ import annotations

from tests.helpers.cli_runner import CliRunner
from tests.helpers.demo_data import demo_calendar_events, demo_contacts, demo_reminders


def _seed_via_cli(cli: CliRunner, suffix: str) -> None:
    for contact in demo_contacts(suffix):
        args = ["contact", "add", contact.display_name, "--handle", contact.handle]
        if contact.email:
            args.extend(["--email", contact.email])
        if contact.phone:
            args.extend(["--phone", contact.phone])
        if contact.alias:
            args.extend(["--alias", contact.alias])

        result = cli.run(*args, json_output=True)
        assert result.returncode == 0, result.stderr
        body = result.json()
        assert body["ok"] is True
        assert body["data"]["contact"]["displayName"] == contact.display_name

    for reminder in demo_reminders(suffix):
        args = [
            "reminder",
            "create",
            "--title",
            reminder.title,
            "--due",
            reminder.due_at,
        ]
        if reminder.notes:
            args.extend(["--notes", reminder.notes])
        if reminder.contact_handle:
            args.extend(["--contact", reminder.contact_handle])

        result = cli.run(*args, json_output=True)
        assert result.returncode == 0, result.stderr
        assert result.json()["ok"] is True

    for event in demo_calendar_events():
        args = [
            "calendar",
            "add",
            "--title",
            event.title,
            "--start",
            event.start_at,
            "--end",
            event.end_at,
        ]
        if event.location:
            args.extend(["--location", event.location])

        result = cli.run(*args, json_output=True)
        assert result.returncode == 0, result.stderr
        payload = result.json()
        assert payload["ok"] is True
        assert payload["data"]["calendarEvent"]["title"] == event.title


def test_cli_whoami_with_dev_pat(cli_runner: CliRunner) -> None:
    result = cli_runner.run("whoami", json_output=True)
    assert result.returncode == 0, result.stderr

    body = result.json()
    assert body["ok"] is True
    assert body["data"]["user"]["id"] == "user_dev"


def test_cli_seeds_demo_dataset(cli_runner: CliRunner, demo_suffix: str) -> None:
    _seed_via_cli(cli_runner, demo_suffix)

    contacts = cli_runner.run("contact", "list", json_output=True)
    assert contacts.returncode == 0
    handles = {item["handle"] for item in contacts.json()["data"]["items"]}
    for contact in demo_contacts(demo_suffix):
        assert contact.handle in handles

    reminders = cli_runner.run("reminder", "list", json_output=True)
    assert reminders.returncode == 0
    titles = {item["title"] for item in reminders.json()["data"]["items"]}
    for reminder in demo_reminders(demo_suffix):
        assert reminder.title in titles

    calendar_list = cli_runner.run("calendar", "list", "--date", "2026-05-26", json_output=True)
    assert calendar_list.returncode == 0
    event_titles = {item["title"] for item in calendar_list.json()["data"]["items"]}
    assert "团队周会" in event_titles

    calendar_today = cli_runner.run("calendar", "today", json_output=True)
    assert calendar_today.returncode == 0
    assert calendar_today.json()["ok"] is True

    today = cli_runner.run("today", json_output=True)
    assert today.returncode == 0
    assert today.json()["ok"] is True


def test_cli_calendar_show_update_delete(cli_runner: CliRunner, demo_suffix: str) -> None:
    event = demo_calendar_events()[0]
    create = cli_runner.run(
        "calendar",
        "add",
        "--title",
        f"{event.title}-{demo_suffix}",
        "--start",
        event.start_at,
        "--end",
        event.end_at,
        "--location",
        event.location or "",
        json_output=True,
    )
    assert create.returncode == 0
    event_id = create.json()["data"]["calendarEvent"]["id"]

    show = cli_runner.run("calendar", "show", event_id, json_output=True)
    assert show.returncode == 0
    assert show.json()["data"]["calendarEvent"]["id"] == event_id

    update = cli_runner.run(
        "calendar",
        "update",
        event_id,
        "--title",
        f"更新-{demo_suffix}",
        json_output=True,
    )
    assert update.returncode == 0
    assert update.json()["data"]["calendarEvent"]["title"] == f"更新-{demo_suffix}"

    delete = cli_runner.run("calendar", "delete", event_id, json_output=True)
    assert delete.returncode == 0
    assert delete.json()["ok"] is True

    missing = cli_runner.run("calendar", "show", event_id, json_output=True)
    assert missing.returncode != 0 or missing.json()["ok"] is False


def test_cli_ignores_trailing_api_url_flag_on_delete(cli_runner: CliRunner, demo_suffix: str) -> None:
    """Legacy scripts may pass --api-url after positional args; must not corrupt IDs."""
    create = cli_runner.run(
        "reminder",
        "create",
        "--title",
        f"flag-test-{demo_suffix}",
        "--due",
        "2026-05-28T10:00:00+08:00",
        json_output=True,
    )
    assert create.returncode == 0
    reminder_id = create.json()["data"]["reminder"]["id"]

    delete = cli_runner.run(
        "reminder",
        "delete",
        reminder_id,
        "--api-url",
        cli_runner.api_url,
        json_output=True,
    )
    assert delete.returncode == 0, delete.stderr
    assert delete.json()["ok"] is True
