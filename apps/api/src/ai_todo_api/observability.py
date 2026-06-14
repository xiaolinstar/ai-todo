from __future__ import annotations

from collections import defaultdict
import json
import logging
import sys
import time
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware.base import RequestResponseEndpoint

from ai_todo_api.config import settings


logger = logging.getLogger("ai_todo_api.access")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "environment": settings.environment,
            "releaseTag": settings.release_tag,
            "gitSha": settings.git_sha,
        }
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging() -> None:
    if not settings.structured_logs_enabled:
        logging.basicConfig(level=logging.INFO)
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


class MetricsRegistry:
    buckets = (0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)

    def __init__(self) -> None:
        self._lock = Lock()
        self._requests: dict[tuple[str, str, str], int] = defaultdict(int)
        self._durations: dict[tuple[str, str, str], list[float]] = defaultdict(list)
        self._started_at = time.time()

    def observe_request(self, *, method: str, path: str, status_code: int, duration: float) -> None:
        status_class = f"{status_code // 100}xx"
        key = (method, path, status_class)
        with self._lock:
            self._requests[key] += 1
            self._durations[key].append(duration)

    def render_prometheus(self) -> str:
        lines = [
            "# HELP ai_todo_build_info Build and runtime metadata.",
            "# TYPE ai_todo_build_info gauge",
            (
                "ai_todo_build_info"
                f'{{environment="{_escape(settings.environment)}",'
                f'release_tag="{_escape(settings.release_tag or "")}",'
                f'git_sha="{_escape(settings.git_sha or "")}"}} 1'
            ),
            "# HELP ai_todo_process_start_time_seconds Unix timestamp when the API process started.",
            "# TYPE ai_todo_process_start_time_seconds gauge",
            f"ai_todo_process_start_time_seconds {self._started_at:.3f}",
            "# HELP ai_todo_http_requests_total Total HTTP requests.",
            "# TYPE ai_todo_http_requests_total counter",
        ]

        with self._lock:
            request_items = list(self._requests.items())
            duration_items = list(self._durations.items())

        for (method, path, status_class), count in sorted(request_items):
            labels = _labels(method=method, path=path, status_class=status_class)
            lines.append(f"ai_todo_http_requests_total{{{labels}}} {count}")

        lines.extend(
            [
                "# HELP ai_todo_http_request_duration_seconds HTTP request duration.",
                "# TYPE ai_todo_http_request_duration_seconds histogram",
            ]
        )
        for (method, path, status_class), durations in sorted(duration_items):
            labels = _labels(method=method, path=path, status_class=status_class)
            for bucket in self.buckets:
                count = sum(1 for value in durations if value <= bucket)
                lines.append(
                    f'ai_todo_http_request_duration_seconds_bucket{{{labels},le="{bucket:g}"}} {count}'
                )
            lines.append(
                f'ai_todo_http_request_duration_seconds_bucket{{{labels},le="+Inf"}} '
                f"{len(durations)}"
            )
            lines.append(
                f"ai_todo_http_request_duration_seconds_count{{{labels}}} {len(durations)}"
            )
            lines.append(
                f"ai_todo_http_request_duration_seconds_sum{{{labels}}} {sum(durations):.6f}"
            )

        return "\n".join(lines) + "\n"

    def reset(self) -> None:
        with self._lock:
            self._requests.clear()
            self._durations.clear()
            self._started_at = time.time()


metrics_registry = MetricsRegistry()


def install_observability(app: FastAPI) -> None:
    configure_logging()

    @app.middleware("http")
    async def request_observability(
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get("x-request-id") or f"req_{uuid4().hex[:16]}"
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start
            route_path = _route_path(request)
            if settings.metrics_enabled and route_path != settings.metrics_path:
                metrics_registry.observe_request(
                    method=request.method,
                    path=route_path,
                    status_code=status_code,
                    duration=duration,
                )
            if settings.structured_logs_enabled:
                logger.info(
                    "http_request",
                    extra={
                        "extra_fields": {
                            "requestId": request_id,
                            "method": request.method,
                            "path": route_path,
                            "status": status_code,
                            "durationMs": round(duration * 1000, 2),
                            "client": request.headers.get("user-agent", ""),
                        }
                    },
                )
            if "response" in locals():
                response.headers["X-Request-ID"] = request_id


def _route_path(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    return request.url.path


def _labels(**values: str) -> str:
    return ",".join(f'{key}="{_escape(value)}"' for key, value in values.items())


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
