from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ai_todo_api.db.models import Base
from ai_todo_api.db.session import get_db
from ai_todo_api.main import app


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
