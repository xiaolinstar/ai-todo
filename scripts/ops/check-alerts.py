#!/usr/bin/env python3
"""Black-box health and alert checks for ai-todo API."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ai-todo production/staging alert checks")
    parser.add_argument("--base-url", default=os.environ.get("ALERT_BASE_URL", "").strip())
    parser.add_argument("--environment", default=os.environ.get("ALERT_ENVIRONMENT", "").strip())
    parser.add_argument("--timeout", type=int, default=int(os.environ.get("ALERT_TIMEOUT", "10")))
    parser.add_argument("--max-latency-ms", type=int, default=int(os.environ.get("ALERT_MAX_LATENCY_MS", "1500")))
    parser.add_argument("--webhook-url", default=os.environ.get("ALERT_WEBHOOK_URL", "").strip())
    parser.add_argument("--json-out", default="")
    return parser.parse_args(argv)


def request(url: str, *, timeout: int) -> tuple[int, str, float]:
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        duration_ms = (time.perf_counter() - start) * 1000
        return response.status, body, duration_ms


def request_json(url: str, *, timeout: int) -> tuple[dict[str, Any], float]:
    status, body, duration_ms = request(url, timeout=timeout)
    if status != 200:
        raise RuntimeError(f"{url} returned HTTP {status}")
    return json.loads(body), duration_ms


def run_checks(args: argparse.Namespace) -> dict[str, Any]:
    if not args.base_url:
        raise RuntimeError("ALERT_BASE_URL or --base-url is required")
    base = args.base_url.rstrip("/")
    checks: list[dict[str, Any]] = []

    health, health_ms = request_json(f"{base}/v1/health", timeout=args.timeout)
    health_data = health.get("data") or {}
    checks.append({"name": "health", "ok": health.get("ok") is True, "durationMs": round(health_ms, 2)})
    if health.get("ok") is not True or health_data.get("status") != "ok":
        raise RuntimeError(f"health is not ok: {health}")
    if health_ms > args.max_latency_ms:
        raise RuntimeError(f"health latency {health_ms:.0f}ms exceeds {args.max_latency_ms}ms")

    db, db_ms = request_json(f"{base}/v1/health/db", timeout=args.timeout)
    db_data = db.get("data") or {}
    checks.append({"name": "health_db", "ok": db.get("ok") is True, "durationMs": round(db_ms, 2)})
    if db.get("ok") is not True or db_data.get("status") != "ok":
        raise RuntimeError(f"health/db is not ok: {db}")

    try:
        status, metrics_body, metrics_ms = request(f"{base}/metrics", timeout=args.timeout)
        metrics_ok = status == 200 and "ai_todo_http_requests_total" in metrics_body
        checks.append({"name": "metrics", "ok": metrics_ok, "durationMs": round(metrics_ms, 2)})
        if not metrics_ok:
            raise RuntimeError("/metrics did not expose ai_todo_http_requests_total")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"/metrics returned HTTP {exc.code}") from exc

    return {
        "ok": True,
        "environment": args.environment or health_data.get("environment") or "unknown",
        "baseUrl": base,
        "releaseTag": health_data.get("releaseTag"),
        "gitSha": health_data.get("gitSha"),
        "checks": checks,
    }


def send_webhook(webhook_url: str, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.status >= 300:
            raise RuntimeError(f"alert webhook returned HTTP {response.status}")


def write_json(path: str, payload: dict[str, Any]) -> None:
    if not path:
        return
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        result = run_checks(args)
        print(f"Alert checks passed ({result['baseUrl']})")
        write_json(args.json_out, result)
        return 0
    except Exception as exc:
        payload = {
            "ok": False,
            "environment": args.environment or "unknown",
            "baseUrl": args.base_url,
            "error": str(exc),
        }
        print(f"Alert checks failed: {exc}", file=sys.stderr)
        write_json(args.json_out, payload)
        if args.webhook_url:
            send_webhook(args.webhook_url, payload)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
