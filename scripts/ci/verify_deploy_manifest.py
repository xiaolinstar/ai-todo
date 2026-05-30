#!/usr/bin/env python3
"""Verify deploy-manifest.json fingerprint (CI/CD + VPS deploy; stdlib only)."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def stable_dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fingerprint_of(payload: object) -> str:
    digest = hashlib.sha256(stable_dumps(payload).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def verify_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    fingerprint = manifest.pop("fingerprint", None)
    if not isinstance(fingerprint, str):
        raise SystemExit("manifest missing fingerprint")

    expected = fingerprint_of(manifest)
    if fingerprint != expected:
        raise SystemExit(f"fingerprint mismatch: got {fingerprint}, expected {expected}")

    if not (
        manifest.get("gitSha")
        and manifest.get("artifacts", {}).get("api", {}).get("image")
        and manifest.get("artifacts", {}).get("api", {}).get("digest")
    ):
        raise SystemExit("manifest missing required fields (gitSha, artifacts.api)")

    return manifest


def main(argv: list[str]) -> int:
    path = Path(argv[1] if len(argv) > 1 else "deploy-manifest.json")
    manifest = verify_manifest(path)
    api_image = manifest["artifacts"]["api"]["image"]
    print(f"manifest OK sha={manifest['gitSha']} image={api_image}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
