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


def test_cli_token_lifecycle_commands(cli_runner: CliRunner, demo_suffix: str) -> None:
    create = cli_runner.run(
        "token",
        "create",
        "--name",
        f"CLI Token {demo_suffix}",
        "--max-idle-days",
        "7",
        json_output=True,
    )
    assert create.returncode == 0, create.stderr
    created = create.json()["data"]
    assert created["token"].startswith("aitodo_")
    assert created["maxIdleDays"] == 7

    token_id = created["id"]
    listed = cli_runner.run("token", "list", json_output=True)
    assert listed.returncode == 0, listed.stderr
    items = listed.json()["data"]["items"]
    assert any(item["id"] == token_id and item["status"] == "active" for item in items)

    revoke = cli_runner.run("token", "revoke", token_id, json_output=True)
    assert revoke.returncode == 0, revoke.stderr
    assert revoke.json()["data"]["id"] == token_id

    listed_after = cli_runner.run("token", "list", json_output=True)
    assert listed_after.returncode == 0, listed_after.stderr
    revoked = [item for item in listed_after.json()["data"]["items"] if item["id"] == token_id]
    assert revoked[0]["status"] == "revoked"


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


def test_cli_reminder_show_update_delete(cli_runner: CliRunner, demo_suffix: str) -> None:
    contact = cli_runner.run(
        "contact",
        "add",
        f"Reminder Contact {demo_suffix}",
        "--handle",
        f"reminder-contact-{demo_suffix}",
        "--email",
        "reminder@example.com",
        json_output=True,
    )
    assert contact.returncode == 0, contact.stderr
    contact_id = contact.json()["data"]["contact"]["id"]

    create = cli_runner.run(
        "reminder",
        "create",
        "--title",
        f"CLI Update {demo_suffix}",
        "--due",
        "2026-06-10T10:00:00+08:00",
        "--contact",
        contact_id,
        json_output=True,
    )
    assert create.returncode == 0, create.stderr
    reminder_id = create.json()["data"]["reminder"]["id"]

    show = cli_runner.run("reminder", "show", reminder_id, json_output=True)
    assert show.returncode == 0, show.stderr
    shown = show.json()["data"]["reminder"]
    assert shown["id"] == reminder_id
    assert shown["contacts"][0]["id"] == contact_id

    update = cli_runner.run(
        "reminder",
        "update",
        reminder_id,
        "--title",
        f"CLI Updated {demo_suffix}",
        "--notes",
        "via cli update",
        "--due",
        "2026-06-11T11:00:00+08:00",
        "--remind",
        "2026-06-11T10:30:00+08:00",
        json_output=True,
    )
    assert update.returncode == 0, update.stderr
    updated = update.json()["data"]["reminder"]
    assert updated["title"] == f"CLI Updated {demo_suffix}"
    assert updated["notes"] == "via cli update"
    assert updated["dueAt"] == "2026-06-11T11:00:00+08:00"
    assert updated["remindAt"] == "2026-06-11T10:30:00+08:00"

    second_contact = cli_runner.run(
        "contact",
        "add",
        f"Reminder Contact B {demo_suffix}",
        "--handle",
        f"reminder-contact-b-{demo_suffix}",
        json_output=True,
    )
    assert second_contact.returncode == 0, second_contact.stderr
    second_id = second_contact.json()["data"]["contact"]["id"]

    relink = cli_runner.run(
        "reminder",
        "update",
        reminder_id,
        "--contact",
        second_id,
        json_output=True,
    )
    assert relink.returncode == 0, relink.stderr
    relinked = relink.json()["data"]["reminder"]["contacts"]
    assert len(relinked) == 1
    assert relinked[0]["id"] == second_id

    clear_contacts = cli_runner.run(
        "reminder",
        "update",
        reminder_id,
        "--contact",
        json_output=True,
    )
    assert clear_contacts.returncode == 0, clear_contacts.stderr
    assert clear_contacts.json()["data"]["reminder"]["contacts"] == []

    delete = cli_runner.run("reminder", "delete", reminder_id, json_output=True)
    assert delete.returncode == 0, delete.stderr
    assert delete.json()["data"]["deleted"] is True

    missing = cli_runner.run("reminder", "show", reminder_id, json_output=True)
    assert missing.returncode != 0 or missing.json()["ok"] is False


def test_cli_contact_show_update(cli_runner: CliRunner, demo_suffix: str) -> None:
    create = cli_runner.run(
        "contact",
        "add",
        f"CLI Update Contact {demo_suffix}",
        "--handle",
        f"cli-update-contact-{demo_suffix}",
        "--email",
        "before@example.com",
        "--company",
        "Acme",
        json_output=True,
    )
    assert create.returncode == 0, create.stderr
    contact_id = create.json()["data"]["contact"]["id"]

    show = cli_runner.run("contact", "show", contact_id, json_output=True)
    assert show.returncode == 0, show.stderr
    assert show.json()["data"]["contact"]["primaryEmail"] == "before@example.com"

    update = cli_runner.run(
        "contact",
        "update",
        contact_id,
        "--name",
        f"CLI Updated Contact {demo_suffix}",
        "--email",
        "after@example.com",
        "--company",
        "Beta",
        json_output=True,
    )
    assert update.returncode == 0, update.stderr
    updated = update.json()["data"]["contact"]
    assert updated["displayName"] == f"CLI Updated Contact {demo_suffix}"
    assert updated["primaryEmail"] == "after@example.com"
    assert updated["company"] == "Beta"

    show_after = cli_runner.run("contact", "show", contact_id, json_output=True)
    assert show_after.returncode == 0, show_after.stderr
    assert show_after.json()["data"]["contact"]["displayName"] == f"CLI Updated Contact {demo_suffix}"


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


def test_cli_contact_delete(cli_runner: CliRunner, demo_suffix: str) -> None:
    create = cli_runner.run(
        "contact",
        "add",
        f"Delete Contact {demo_suffix}",
        "--handle",
        f"delete-contact-{demo_suffix}",
        json_output=True,
    )
    assert create.returncode == 0, create.stderr
    contact_id = create.json()["data"]["contact"]["id"]

    search = cli_runner.run("contact", "search", f"delete-contact-{demo_suffix}", json_output=True)
    assert search.returncode == 0, search.stderr
    assert any(item["id"] == contact_id for item in search.json()["data"]["items"])

    delete = cli_runner.run("contact", "delete", contact_id, json_output=True)
    assert delete.returncode == 0, delete.stderr
    assert delete.json()["data"]["deleted"] is True

    missing = cli_runner.run("contact", "show", contact_id, json_output=True)
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
