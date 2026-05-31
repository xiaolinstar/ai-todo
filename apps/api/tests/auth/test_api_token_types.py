from unittest.mock import patch

from fastapi.testclient import TestClient

from sqlalchemy import select

from ai_todo_api.auth.wechat_client import WechatSession
from ai_todo_api.config import settings
from ai_todo_api.db.models import ApiTokenModel
from ai_todo_api.db.session import get_db
from ai_todo_api.main import app
from ai_todo_api.modules.api_tokens.constants import TOKEN_TYPE_SESSION


def test_wechat_login_issues_session_not_pat(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_session_kind", union_id=None),
    ):
        response = client.post("/v1/auth/wechat/login", json={"code": "code_session"})

    assert response.status_code == 200
    body = response.json()
    session_token = body["data"]["accessToken"]
    assert body["data"]["tokenType"] == "session"

    db_gen = app.dependency_overrides[get_db]()
    session = next(db_gen)
    try:
        rows = session.scalars(select(ApiTokenModel)).all()
        session_rows = [item for item in rows if item.token_type == TOKEN_TYPE_SESSION]
        assert len(session_rows) == 1
    finally:
        db_gen.close()

    list_response = client.get(
        "/v1/api-tokens",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"] == []


def test_session_can_create_pat(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_pat_create", union_id=None),
    ):
        login = client.post("/v1/auth/wechat/login", json={"code": "code_pat"})

    session_token = login.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {session_token}"}

    create = client.post(
        "/v1/api-tokens",
        json={"name": "Mac CLI", "scopes": ["read", "write"]},
        headers=headers,
    )
    assert create.status_code == 201
    pat = create.json()["data"]["token"]
    assert create.json()["data"]["tokenType"] == "pat"

    list_response = client.get("/v1/api-tokens", headers=headers)
    assert len(list_response.json()["data"]["items"]) == 1
    assert list_response.json()["data"]["items"][0]["name"] == "Mac CLI"

    me = client.get(
        "/v1/me",
        headers={"Authorization": f"Bearer {pat}", "X-Client-Source": "cli"},
    )
    assert me.status_code == 200


def test_cli_rejects_session_token(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_cli_block", union_id=None),
    ):
        login = client.post("/v1/auth/wechat/login", json={"code": "code_cli"})

    session_token = login.json()["data"]["accessToken"]
    response = client.get(
        "/v1/me",
        headers={
            "Authorization": f"Bearer {session_token}",
            "X-Client-Source": "cli",
        },
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_TOKEN_NOT_ALLOWED"


def test_new_wechat_login_revokes_previous_session(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")
    openid = "openid_revoke_session"

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid=openid, union_id=None),
    ):
        first = client.post("/v1/auth/wechat/login", json={"code": "code_a"})
        second = client.post("/v1/auth/wechat/login", json={"code": "code_b"})

    first_token = first.json()["data"]["accessToken"]
    second_token = second.json()["data"]["accessToken"]
    assert first_token != second_token

    stale = client.get(
        "/v1/me",
        headers={"Authorization": f"Bearer {first_token}", "X-Client-Source": "miniapp"},
    )
    assert stale.status_code == 401

    fresh = client.get(
        "/v1/me",
        headers={"Authorization": f"Bearer {second_token}", "X-Client-Source": "miniapp"},
    )
    assert fresh.status_code == 200
