#!/usr/bin/env python3
"""Post-deploy smoke / black-box checks against the public API URL (CD step 3 & 5)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Post-deploy public API verification")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("CD_PUBLIC_API_URL", "https://xingxiaolin.cn").strip(),
    )
    parser.add_argument("--expect-git-sha", default="")
    parser.add_argument(
        "--skip-git-sha-check",
        action="store_true",
        help="Only run health/db (and optional PAT); used after rollback",
    )
    parser.add_argument("--release-tag", default=os.environ.get("RELEASE_TAG", "").strip())
    parser.add_argument(
        "--strict-release-tag",
        action="store_true",
        default=os.environ.get("CD_VERIFY_STRICT_RELEASE_TAG", "true").lower()
        not in ("0", "false", "no"),
    )
    parser.add_argument("--pat", default=os.environ.get("CD_SMOKE_PAT", "").strip())
    parser.add_argument("--timeout", type=int, default=int(os.environ.get("CD_VERIFY_TIMEOUT", "30")))
    parser.add_argument("--retries", type=int, default=int(os.environ.get("CD_VERIFY_RETRIES", "3")))
    parser.add_argument("--json-out", default="")
    return parser.parse_args(argv)


def request_json(
    url: str,
    *,
    timeout: int,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        return response.status, json.loads(body)


def fetch_with_retries(
    url: str,
    *,
    timeout: int,
    retries: int,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            status, payload = request_json(url, timeout=timeout, headers=headers)
            if status != 200:
                raise RuntimeError(f"HTTP {status} for {url}")
            return payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
            if attempt < retries:
                continue
    raise RuntimeError(f"Failed after {retries} attempts: {url}") from last_error


def normalize_sha(value: str) -> str:
    return (value or "").strip().lower()


def sha_matches(actual: str, expected: str) -> bool:
    a = normalize_sha(actual)
    e = normalize_sha(expected)
    if not a or not e:
        return False
    return a == e or a.startswith(e) or e.startswith(a)


def check_health(
    base: str,
    *,
    timeout: int,
    retries: int,
    expect_git_sha: str,
    release_tag: str,
    strict_release_tag: bool,
    checks: list[dict[str, Any]],
) -> None:
    health = fetch_with_retries(f"{base}/v1/health", timeout=timeout, retries=retries)
    checks.append({"name": "health", "ok": True, "data": health.get("data")})

    if not health.get("ok"):
        raise RuntimeError(f"/v1/health returned ok=false: {health}")

    data = health.get("data") or {}
    if data.get("status") != "ok":
        raise RuntimeError(f"health status not ok: {data.get('status')}")

    actual_sha = str(data.get("gitSha") or "")
    if expect_git_sha and not sha_matches(actual_sha, expect_git_sha):
        raise RuntimeError(
            f"gitSha mismatch: health has {actual_sha!r}, expected {expect_git_sha!r}"
        )

    if strict_release_tag and release_tag:
        actual_tag = str(data.get("releaseTag") or "")
        if actual_tag != release_tag:
            raise RuntimeError(
                f"releaseTag mismatch: health has {actual_tag!r}, expected {release_tag!r}"
            )


def check_health_db(
    base: str,
    *,
    timeout: int,
    retries: int,
    checks: list[dict[str, Any]],
) -> None:
    payload = fetch_with_retries(f"{base}/v1/health/db", timeout=timeout, retries=retries)
    checks.append({"name": "health_db", "ok": True})

    if not payload.get("ok"):
        raise RuntimeError(f"/v1/health/db returned ok=false: {payload}")

    data = payload.get("data") or {}
    if data.get("status") != "ok":
        raise RuntimeError(f"health/db status not ok: {data.get('status')}")
    if data.get("identitiesTable") is not True:
        raise RuntimeError("health/db identitiesTable is not true")
    if data.get("usersHasUsername") is not True:
        raise RuntimeError("health/db usersHasUsername is not true")


def check_authenticated_smoke(
    base: str,
    *,
    pat: str,
    timeout: int,
    retries: int,
    checks: list[dict[str, Any]],
) -> None:
    headers = {"Authorization": f"Bearer {pat}"}
    me = fetch_with_retries(f"{base}/v1/me", timeout=timeout, retries=retries, headers=headers)
    checks.append({"name": "me", "ok": True})
    if not me.get("ok") or not (me.get("data") or {}).get("user"):
        raise RuntimeError(f"/v1/me failed: {me}")

    today = fetch_with_retries(f"{base}/v1/today", timeout=timeout, retries=retries, headers=headers)
    checks.append({"name": "today", "ok": True})
    if not today.get("ok"):
        raise RuntimeError(f"/v1/today failed: {today}")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    checks: list[dict[str, Any]] = []
    outcome = "failed"
    error_message = ""

    if not args.base_url:
        error_message = (
            "CD_PUBLIC_API_URL is not set. Add it to the GitHub Environment "
            "(e.g. https://xingxiaolin.cn) before running post-deploy verify."
        )
        print(error_message, file=sys.stderr)
        _write_json_out(args.json_out, outcome, error_message, checks, args)
        return 2

    base = args.base_url.rstrip("/")

    expect_sha = "" if args.skip_git_sha_check else args.expect_git_sha
    if not args.skip_git_sha_check and not expect_sha:
        error_message = "--expect-git-sha is required unless --skip-git-sha-check is set"
        print(error_message, file=sys.stderr)
        _write_json_out(args.json_out, outcome, error_message, checks, args)
        return 2

    strict_tag = args.strict_release_tag and not args.skip_git_sha_check

    try:
        check_health(
            base,
            timeout=args.timeout,
            retries=args.retries,
            expect_git_sha=expect_sha,
            release_tag=args.release_tag,
            strict_release_tag=strict_tag,
            checks=checks,
        )
        check_health_db(base, timeout=args.timeout, retries=args.retries, checks=checks)
        if args.pat:
            check_authenticated_smoke(
                base,
                pat=args.pat,
                timeout=args.timeout,
                retries=args.retries,
                checks=checks,
            )
        else:
            checks.append({"name": "authenticated_smoke", "ok": True, "skipped": True})
        outcome = "passed"
        print(f"Post-deploy verify passed ({base})")
        _write_json_out(args.json_out, outcome, "", checks, args)
        return 0
    except Exception as exc:
        error_message = str(exc)
        print(f"Post-deploy verify failed: {error_message}", file=sys.stderr)
        checks.append({"name": "error", "ok": False, "message": error_message})
        _write_json_out(args.json_out, outcome, error_message, checks, args)
        return 1


def _write_json_out(
    path: str,
    outcome: str,
    error: str,
    checks: list[dict[str, Any]],
    args: argparse.Namespace,
) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT", "").strip()
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            handle.write(f"error={error or ''}\n")

    if not path:
        return
    payload = {
        "outcome": outcome,
        "baseUrl": args.base_url.rstrip("/") if args.base_url else None,
        "expectGitSha": args.expect_git_sha,
        "releaseTag": args.release_tag or None,
        "checks": checks,
        "error": error or None,
    }
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
