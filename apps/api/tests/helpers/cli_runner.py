"""Run the built ai-todo CLI as a subprocess in tests."""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
CLI_ENTRY = REPO_ROOT / "apps" / "cli" / "dist" / "index.js"


@dataclass(frozen=True)
class CliResult:
    returncode: int
    stdout: str
    stderr: str

    def json(self) -> dict:
        text = self.stdout.strip()
        return json.loads(text)


class CliRunner:
    def __init__(self, *, api_url: str, token: str) -> None:
        self.api_url = api_url
        self.token = token

    def run(self, *args: str, json_output: bool = False) -> CliResult:
        if not CLI_ENTRY.is_file():
            raise FileNotFoundError(
                f"CLI not built: {CLI_ENTRY}. Run `pnpm --filter @xiaolinstar/ai-todo-cli build` first."
            )

        command = ["node", str(CLI_ENTRY), *args]
        if json_output and "--json" not in args:
            command.append("--json")

        env = os.environ.copy()
        env["AI_TODO_API_URL"] = self.api_url
        env["AI_TODO_TOKEN"] = self.token

        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )
        return CliResult(
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
