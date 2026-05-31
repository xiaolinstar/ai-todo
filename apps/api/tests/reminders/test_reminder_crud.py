from fastapi.testclient import TestClient


def test_list_update_reschedule_and_delete(client: TestClient) -> None:
    create_a = client.post(
        "/v1/reminders",
        json={"title": "周五交方案", "dueAt": "2026-05-23T18:00:00+08:00"},
    )
    create_b = client.post(
        "/v1/reminders",
        json={"title": "无截止待办"},
    )
    assert create_a.status_code == 201
    assert create_b.status_code == 201
    reminder_a = create_a.json()["data"]["reminder"]
    reminder_b = create_b.json()["data"]["reminder"]

    list_pending = client.get("/v1/reminders", params={"status": "pending"})
    assert list_pending.status_code == 200
    pending_ids = {item["id"] for item in list_pending.json()["data"]["items"]}
    assert reminder_a["id"] in pending_ids
    assert reminder_b["id"] in pending_ids

    list_range = client.get(
        "/v1/reminders",
        params={"from": "2026-05-23", "to": "2026-05-23"},
    )
    range_ids = {item["id"] for item in list_range.json()["data"]["items"]}
    assert reminder_a["id"] in range_ids
    assert reminder_b["id"] not in range_ids

    patch_response = client.patch(
        f"/v1/reminders/{reminder_a['id']}",
        json={"title": "周五交最终方案", "notes": "发给客户"},
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()["data"]["reminder"]
    assert patched["title"] == "周五交最终方案"
    assert patched["notes"] == "发给客户"

    reschedule_response = client.post(
        f"/v1/reminders/{reminder_a['id']}/reschedule",
        json={
            "dueAt": "2026-05-25T10:00:00+08:00",
            "remindAt": "2026-05-25T09:30:00+08:00",
        },
    )
    assert reschedule_response.status_code == 200
    rescheduled = reschedule_response.json()["data"]["reminder"]
    assert rescheduled["dueAt"] == "2026-05-25T10:00:00+08:00"
    assert rescheduled["remindAt"] == "2026-05-25T09:30:00+08:00"

    detail_response = client.get(f"/v1/reminders/{reminder_a['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["reminder"]["id"] == reminder_a["id"]

    delete_response = client.delete(f"/v1/reminders/{reminder_a['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True

    after_delete = client.get(f"/v1/reminders/{reminder_a['id']}")
    assert after_delete.status_code == 404

    list_after_delete = client.get("/v1/reminders")
    remaining_ids = {item["id"] for item in list_after_delete.json()["data"]["items"]}
    assert reminder_a["id"] not in remaining_ids
    assert reminder_b["id"] in remaining_ids


def test_today_excludes_completed_and_deleted(client: TestClient) -> None:
    create_response = client.post("/v1/reminders", json={"title": "今日待办"})
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    today_before = client.get("/v1/reminders/today")
    assert today_before.status_code == 200
    assert reminder_id in {item["id"] for item in today_before.json()["data"]["items"]}

    complete_response = client.post(f"/v1/reminders/{reminder_id}/complete")
    assert complete_response.status_code == 200

    today_after = client.get("/v1/reminders/today")
    assert reminder_id not in {item["id"] for item in today_after.json()["data"]["items"]}

    list_completed = client.get("/v1/reminders", params={"status": "completed"})
    assert reminder_id in {item["id"] for item in list_completed.json()["data"]["items"]}
