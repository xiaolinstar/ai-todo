from fastapi.testclient import TestClient


def test_health_includes_deploy_metadata(client: TestClient) -> None:
    response = client.get("/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["service"] == "ai-todo-api"
    assert body["data"]["status"] == "ok"
    assert body["data"]["apiVersion"] == "0.3.0"
    assert "releaseTag" in body["data"]
    assert "gitSha" in body["data"]


def test_root_preview_includes_cli_onboarding(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    html = response.text
    assert "npm install -g @xiaolinstar/ai-todo-cli" in html
    assert "~/.ai-todo/settings.json" in html
    assert "ai-todo whoami" in html
    assert "@ai-todo/cli" not in html
    assert "ai-todo login" not in html


def test_root_preview_includes_public_onboarding(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    html = response.text
    assert "/favicon.svg" in html
    assert "/favicon.ico" in html
    assert "/static/icons/ai-todo.svg" in html
    assert "苏ICP备2026011017号-7" in html
    assert "苏公网安备32010602012480号" in html
    assert "©️ 2026 xiaolinstar. All rights reserved." in html
    assert "gonganlianwang.png" in html
    assert "微信搜索「AI日省待办」" in html
    assert "Mac / Linux" in html
    assert "粘贴 PAT" in html
    assert "面向用户" in html
    assert "面向 Agent" in html
    assert "skills/ai-todo/SKILL.md" in html


def test_public_icons_are_served(client: TestClient) -> None:
    favicon_response = client.get("/static/icons/ai-todo.svg")
    favicon_root_response = client.get("/favicon.ico")
    gongan_response = client.get("/static/icons/gonganlianwang.png")

    assert favicon_response.status_code == 200
    assert favicon_response.headers["content-type"].startswith("image/svg+xml")
    assert favicon_root_response.status_code == 200
    assert favicon_root_response.headers["content-type"].startswith("image/svg+xml")
    assert gongan_response.status_code == 200
    assert gongan_response.headers["content-type"].startswith("image/png")
