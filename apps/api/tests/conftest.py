from collections.abc import Generator
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ai_todo_api.db.models import Base
from ai_todo_api.db.session import get_db
from ai_todo_api.main import app
from tests.helpers.cli_runner import CLI_ENTRY, REPO_ROOT, CliRunner


engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = override_get_db


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="session")
def cli_built() -> None:
    if CLI_ENTRY.is_file():
        return
    subprocess.run(
        ["pnpm", "--filter", "@ai-todo/cli", "build"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert CLI_ENTRY.is_file(), f"CLI build failed: {CLI_ENTRY}"


@pytest.fixture
def demo_suffix() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture
def live_api_url(cli_built: None) -> Generator[str, None, None]:
    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="critical")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            with urllib.request.urlopen(f"{base_url}/v1/health", timeout=0.2) as response:
                if response.status == 200:
                    break
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.05)
    else:
        pytest.fail("Live API server did not start in time.")

    yield base_url

    server.should_exit = True
    thread.join(timeout=5)


@pytest.fixture
def dev_pat_token(live_api_url: str) -> str:
    response = httpx.post(
        f"{live_api_url}/v1/auth/dev/issue-pat",
        json={"name": "pytest-cli"},
        timeout=10,
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["token"]


@pytest.fixture
def cli_runner(live_api_url: str, dev_pat_token: str) -> CliRunner:
    return CliRunner(api_url=live_api_url, token=dev_pat_token)


@pytest.fixture(autouse=True)
def reset_wechat_login_rate_limiter() -> Generator[None, None, None]:
    from ai_todo_api.auth import rate_limit as rate_limit_module
    from ai_todo_api.common.rate_limit import SlidingWindowRateLimiter
    from ai_todo_api.config import settings

    rate_limit_module._wechat_login_limiter = SlidingWindowRateLimiter(
        max_requests=settings.rate_limit_wechat_login_per_minute,
        window_seconds=60,
    )
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
