from unittest.mock import patch

from fastapi.testclient import TestClient

from ai_todo_api.auth.wechat_client import WechatSession
from ai_todo_api.config import settings


def test_wechat_login_creates_user_and_token(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_abc", union_id=None),
    ):
        first = client.post("/v1/auth/wechat/login", json={"code": "code_1"})
        second = client.post("/v1/auth/wechat/login", json={"code": "code_2"})

    assert first.status_code == 200
    body = first.json()
    assert body["ok"] is True
    assert body["data"]["accessToken"].startswith("aitodo_")
    assert body["data"]["user"]["displayName"] == "微信用户"

    assert second.status_code == 200
    assert second.json()["data"]["user"]["id"] == body["data"]["user"]["id"]

    token = body["data"]["accessToken"]
    me = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["user"]["id"] == body["data"]["user"]["id"]


def test_wechat_login_requires_server_config(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", None)
    monkeypatch.setattr(settings, "wechat_app_secret", None)

    response = client.post("/v1/auth/wechat/login", json={"code": "code_1"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "WECHAT_NOT_CONFIGURED"


def test_wechat_login_rejects_invalid_code(client: TestClient, monkeypatch) -> None:
    from ai_todo_api.auth.wechat_client import WechatAuthError

    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        side_effect=WechatAuthError("INVALID_WECHAT_CODE", "invalid code"),
    ):
        response = client.post("/v1/auth/wechat/login", json={"code": "bad_code"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_WECHAT_CODE"
