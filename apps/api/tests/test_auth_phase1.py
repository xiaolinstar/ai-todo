from fastapi.testclient import TestClient
from ai_todo_api.config import settings
from ai_todo_api.auth.service import ensure_dev_user
from tests.conftest import TestingSessionLocal


def _seed_dev_user() -> None:
    with TestingSessionLocal() as session:
        ensure_dev_user(
            session,
            user_id=settings.dev_user_id,
            display_name=settings.dev_user_display_name,
            timezone=settings.timezone,
        )


def _dev_session_token(client: TestClient, monkeypatch) -> str:
    monkeypatch.setattr(settings, "wechat_app_id", None)
    monkeypatch.setattr(settings, "wechat_app_secret", None)
    monkeypatch.setattr(settings, "allow_dev_auth", True)
    response = client.post("/v1/auth/wechat/login", json={"code": "dev_session"})
    assert response.status_code == 200
    return response.json()["data"]["accessToken"]


def test_create_token_and_authenticate(client: TestClient, monkeypatch) -> None:
    _seed_dev_user()
    session_token = _dev_session_token(client, monkeypatch)

    create_response = client.post(
        "/v1/api-tokens",
        json={"name": "Test Agent", "scopes": ["read", "write"]},
        headers={"Authorization": f"Bearer {session_token}"},
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


def test_api_tokens_require_bearer(client: TestClient) -> None:
    _seed_dev_user()
    response = client.post(
        "/v1/api-tokens",
        json={"name": "Should Fail", "scopes": ["read", "write"]},
    )
    assert response.status_code == 401


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


def test_read_only_token_cannot_write(client: TestClient, monkeypatch) -> None:
    _seed_dev_user()
    session_token = _dev_session_token(client, monkeypatch)

    create_token = client.post(
        "/v1/api-tokens",
        json={"name": "Read only", "scopes": ["read"]},
        headers={"Authorization": f"Bearer {session_token}"},
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


def test_dev_issue_pat_endpoint(client: TestClient, monkeypatch) -> None:
    _seed_dev_user()
    monkeypatch.setattr(settings, "allow_dev_auth", True)

    response = client.post("/v1/auth/dev/issue-pat", json={"name": "CLI Local"})
    assert response.status_code == 201
    token = response.json()["data"]["token"]
    assert token.startswith("aitodo_")

    me = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200


def test_revoke_all_pats(client: TestClient, monkeypatch) -> None:
    _seed_dev_user()
    session_token = _dev_session_token(client, monkeypatch)
    headers = {"Authorization": f"Bearer {session_token}"}

    client.post("/v1/api-tokens/revoke-all", headers=headers)

    client.post(
        "/v1/api-tokens",
        json={"name": "One", "scopes": ["read", "write"]},
        headers=headers,
    )
    client.post(
        "/v1/api-tokens",
        json={"name": "Two", "scopes": ["read", "write"]},
        headers=headers,
    )

    listed = client.get("/v1/api-tokens", headers=headers)
    assert len(listed.json()["data"]["items"]) == 2

    revoked = client.post("/v1/api-tokens/revoke-all", headers=headers)
    assert revoked.status_code == 200
    assert revoked.json()["data"]["revokedCount"] == 2

    listed_after = client.get("/v1/api-tokens", headers=headers)
    assert listed_after.json()["data"]["items"] == []
