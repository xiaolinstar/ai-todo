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

    token = second.json()["data"]["accessToken"]
    me = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["user"]["id"] == body["data"]["user"]["id"]


def test_wechat_login_requires_server_config(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", None)
    monkeypatch.setattr(settings, "wechat_app_secret", None)
    monkeypatch.setattr(settings, "allow_dev_auth", False)

    response = client.post("/v1/auth/wechat/login", json={"code": "code_1"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "WECHAT_NOT_CONFIGURED"


def test_wechat_login_dev_fallback_without_wechat_config(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", None)
    monkeypatch.setattr(settings, "wechat_app_secret", None)
    monkeypatch.setattr(settings, "allow_dev_auth", True)

    response = client.post("/v1/auth/wechat/login", json={"code": "any_code"})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["accessToken"].startswith("aitodo_")
    assert body["data"]["user"]["id"] == settings.dev_user_id
    assert body["data"]["user"]["displayName"] == settings.dev_user_display_name


def test_wechat_login_retries_after_identity_race(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    calls = {"count": 0}
    original = __import__(
        "ai_todo_api.auth.wechat_service", fromlist=["_get_or_create_user"]
    )._get_or_create_user

    def flaky_get_or_create_user(session, wechat_session, *, commit: bool):
        calls["count"] += 1
        if calls["count"] == 1 and commit is False:
            from sqlalchemy.exc import IntegrityError

            raise IntegrityError("insert", {}, Exception("race"))
        return original(session, wechat_session, commit=commit)

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_race", union_id=None),
    ), patch(
        "ai_todo_api.auth.wechat_service._get_or_create_user",
        side_effect=flaky_get_or_create_user,
    ):
        response = client.post("/v1/auth/wechat/login", json={"code": "code_race"})

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_wechat_login_recovers_orphan_identity(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    from ai_todo_api.common.time import now_utc
    from ai_todo_api.db.models import IdentityModel
    from ai_todo_api.db.session import get_db
    from ai_todo_api.main import app

    now = now_utc()
    db_gen = app.dependency_overrides[get_db]()
    session = next(db_gen)
    try:
        session.add(
            IdentityModel(
                id="id_orphan",
                user_id="user_missing",
                provider="wechat",
                provider_subject="openid_orphan",
                union_id=None,
                created_at=now,
                last_used_at=now,
            )
        )
        session.commit()
    finally:
        db_gen.close()

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_orphan", union_id=None),
    ):
        response = client.post("/v1/auth/wechat/login", json={"code": "code_orphan"})

    assert response.status_code == 200
    assert response.json()["data"]["user"]["displayName"] == "微信用户"


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
