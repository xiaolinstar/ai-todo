import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CliCommandSpec {
  executable: string;
  args: string[];
}

export function resolveCliCommand(): CliCommandSpec {
  const override = process.env.AI_TODO_CLI_PATH?.trim();
  if (override) {
    if (override.endsWith(".js")) {
      return { executable: process.execPath, args: [override] };
    }
    return { executable: override, args: [] };
  }

  const bundled = path.resolve(__dirname, "../../../apps/cli/dist/index.js");
  if (fs.existsSync(bundled)) {
    return { executable: process.execPath, args: [bundled] };
  }

  return { executable: "ai-todo", args: [] };
}

export function runAiTodoCli(cliArgs: string[]): Promise<CliRunResult> {
  const base = resolveCliCommand();
  const args = [...base.args, ...cliArgs, "--json"];

  return new Promise((resolve, reject) => {
    const child = spawn(base.executable, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

export function formatToolResult(result: CliRunResult): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const trimmed = result.stdout.trim();
  let text = trimmed;
  if (trimmed) {
    try {
      text = JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      text = trimmed;
    }
  } else if (result.stderr.trim()) {
    text = result.stderr.trim();
  }

  if (result.exitCode !== 0) {
    const detail = [text, result.stderr.trim()].filter(Boolean).join("\n");
    return {
      content: [{ type: "text", text: detail || `ai-todo exited with code ${result.exitCode}` }],
      isError: true
    };
  }

  return {
    content: [{ type: "text", text: text || "{}" }]
  };
}
