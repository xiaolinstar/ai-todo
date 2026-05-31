from unittest.mock import patch

from fastapi.testclient import TestClient

from ai_todo_api.auth import rate_limit as rate_limit_module
from ai_todo_api.auth.wechat_client import WechatSession
from ai_todo_api.common.rate_limit import SlidingWindowRateLimiter
from ai_todo_api.config import settings


def test_wechat_login_rate_limit_by_ip(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_wechat_login_per_minute", 2)
    rate_limit_module._wechat_login_limiter = SlidingWindowRateLimiter(
        max_requests=2,
        window_seconds=60,
    )
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_rate_limit", union_id=None),
    ):
        first = client.post(
            "/v1/auth/wechat/login",
            json={"code": "code_1"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        second = client.post(
            "/v1/auth/wechat/login",
            json={"code": "code_2"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        third = client.post(
            "/v1/auth/wechat/login",
            json={"code": "code_3"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["error"]["code"] == "RATE_LIMITED"


def test_wechat_login_rate_limit_can_be_disabled(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    rate_limit_module._wechat_login_limiter = SlidingWindowRateLimiter(
        max_requests=1,
        window_seconds=60,
    )
    monkeypatch.setattr(settings, "wechat_app_id", "wx_test_app")
    monkeypatch.setattr(settings, "wechat_app_secret", "test_secret")

    with patch(
        "ai_todo_api.auth.wechat_service.exchange_wechat_code",
        return_value=WechatSession(openid="openid_no_limit", union_id=None),
    ):
        first = client.post("/v1/auth/wechat/login", json={"code": "code_1"})
        second = client.post("/v1/auth/wechat/login", json={"code": "code_2"})

    assert first.status_code == 200
    assert second.status_code == 200
