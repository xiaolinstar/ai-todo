import { AiTodoClient } from "@ai-todo/api-client";
import type { ApiResponse } from "@ai-todo/shared";

import { loadConfig, saveConfig } from "./config";

export interface CliContext {
  json: boolean;
  apiUrl: string;
  client: AiTodoClient;
}

const GLOBAL_FLAGS = new Set([
  "--json",
  "--api-url",
  "--yes",
  "--idempotency-key",
  "--profile"
]);

export function buildContext(argv: string[]): CliContext {
  const json = argv.includes("--json");
  const apiUrlFlag = readFlagValue(argv, "--api-url");
  const fileConfig = loadConfig();
  const apiUrl =
    apiUrlFlag ?? process.env.AI_TODO_API_URL ?? fileConfig.apiUrl ?? "http://127.0.0.1:3100";

  return {
    json,
    apiUrl,
    client: new AiTodoClient({
      apiUrl,
      token: fileConfig.token ?? process.env.AI_TODO_TOKEN,
      source: "cli",
      idempotencyKey: readFlagValue(argv, "--idempotency-key")
    })
  };
}

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

export function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function positionalAfter(argv: string[], ...anchors: string[]): string | undefined {
  let start = -1;
  for (const anchor of anchors) {
    const index = argv.indexOf(anchor);
    if (index > start) {
      start = index;
    }
  }
  if (start < 0) {
    return undefined;
  }

  const values: string[] = [];
  for (let index = start + 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (GLOBAL_FLAGS.has(arg) || arg === "--email" || arg === "--phone" || arg === "--alias") {
      if (!GLOBAL_FLAGS.has(arg)) {
        index += 1;
      }
      continue;
    }
    if (
      arg.startsWith("--") &&
      [
        "--title",
        "--due",
        "--remind",
        "--notes",
        "--start",
        "--end",
        "--location",
        "--status",
        "--date",
        "--from",
        "--to"
      ].includes(arg)
    ) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      continue;
    }
    values.push(arg);
  }

  return values.length > 0 ? values.join(" ") : undefined;
}

export async function handleApi<T>(
  ctx: CliContext,
  response: ApiResponse<T>,
  render: (data: T) => void
): Promise<void> {
  if (ctx.json) {
    console.log(JSON.stringify(response, null, 2));
    process.exitCode = response.ok ? 0 : 1;
    return;
  }

  if (!response.ok) {
    const code = response.error.code ? `[${response.error.code}] ` : "";
    console.error(`${code}${response.error.message}`);
    process.exitCode = 1;
    return;
  }

  render(response.data);
}

export function persistApiUrl(apiUrl: string): void {
  saveConfig({ apiUrl });
}
