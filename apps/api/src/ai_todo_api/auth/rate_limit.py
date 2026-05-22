from fastapi import HTTPException, Request

from ai_todo_api.common.rate_limit import SlidingWindowRateLimiter
from ai_todo_api.config import settings


_wechat_login_limiter = SlidingWindowRateLimiter(
    max_requests=settings.rate_limit_wechat_login_per_minute,
    window_seconds=60,
)


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


def enforce_wechat_login_rate_limit(request: Request) -> None:
    if not settings.rate_limit_enabled:
        return

    if not _wechat_login_limiter.allow(client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail={
                "ok": False,
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many WeChat login attempts. Please try again later.",
                },
            },
        )
