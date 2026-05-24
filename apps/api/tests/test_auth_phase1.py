from fastapi.testclient import TestClient

from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.config import settings
from tests.conftest import TestingSessionLocal


def _seed_dev_user() -> None:
    with TestingSessionLocal() as session:
        ensure_dev_user(
            session,
            user_id=settings.dev_user_id,
            display_name=settings.dev_user_display_name,
            timezone=settings.timezone,
        )


def test_create_token_and_authenticate(client: TestClient) -> None:
    _seed_dev_user()

    create_response = client.post(
        "/v1/api-tokens",
        json={"name": "Test Agent", "scopes": ["read", "write"]},
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["ok"] is True
    plain_token = body["data"]["token"]
    assert plain_token.startswith("aitodo_")

    me_response = client.get(
        "/v1/me",
        headers={"Authorization": f"Bearer {plain_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["data"]["user"]["id"] == settings.dev_user_id


def test_idempotency_replays_create_reminder(client: TestClient) -> None:
    _seed_dev_user()
    headers = {"Idempotency-Key": "idem-test-rem-1"}

    first = client.post(
        "/v1/reminders",
        json={"title": "幂等测试"},
        headers=headers,
    )
    second = client.post(
        "/v1/reminders",
        json={"title": "幂等测试"},
        headers=headers,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["reminder"]["id"] == second.json()["data"]["reminder"]["id"]


def test_read_only_token_cannot_write(client: TestClient) -> None:
    _seed_dev_user()

    create_token = client.post(
        "/v1/api-tokens",
        json={"name": "Read only", "scopes": ["read"]},
    )
    token = create_token.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/v1/reminders",
        json={"title": "应被拒绝"},
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
