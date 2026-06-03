import { AiTodoClient } from "@ai-todo/api-client";
import type { ApiResponse } from "@ai-todo/shared";

import { printAuthHint, resolveTokenSource } from "./auth";
import { loadSettings, resolveApiUrl, saveSettings } from "./settings";

export interface CliContext {
  json: boolean;
  apiUrl: string;
  client: AiTodoClient;
}

const GLOBAL_FLAGS = new Set(["--json", "--yes", "--api-url", "--url", "--idempotency-key", "--profile"]);
const GLOBAL_FLAGS_WITH_VALUE = new Set(["--api-url", "--url", "--idempotency-key", "--profile"]);

/** Strip global flags before resolving positional args (e.g. trailing --api-url). */
export function commandArgv(argv: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (GLOBAL_FLAGS.has(arg)) {
      if (GLOBAL_FLAGS_WITH_VALUE.has(arg)) {
        index += 1;
      }
      continue;
    }
    result.push(arg);
  }
  return result;
}

export function buildContext(argv: string[]): CliContext {
  const json = argv.includes("--json");
  const settings = loadSettings();
  const apiUrl = resolveApiUrl(settings);
  const { token } = resolveTokenSource();

  return {
    json,
    apiUrl,
    client: new AiTodoClient({
      apiUrl,
      token,
      source: "cli",
      idempotencyKey: readFlagValue(argv, "--idempotency-key")
    })
  };
}

declare const process: {
  exitCode?: number;
};

export function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function readRepeatedFlag(argv: string[], flag: string): string[] {
  const values: string[] = [];
  const args = commandArgv(argv);
  for (let index = 0; index < args.length; index += 1) {
    const next = args[index + 1];
    if (args[index] === flag && next && !next.startsWith("-")) {
      values.push(next);
    }
  }
  return values;
}

export function hasFlag(argv: string[], flag: string): boolean {
  return commandArgv(argv).includes(flag);
}

export function positionalAfter(argv: string[], ...anchors: string[]): string | undefined {
  const args = commandArgv(argv);
  let start = -1;
  for (const anchor of anchors) {
    const index = args.indexOf(anchor);
    if (index > start) {
      start = index;
    }
  }
  if (start < 0) {
    return undefined;
  }

  const values: string[] = [];
  for (let index = start + 1; index < args.length; index += 1) {
    const arg = args[index];
    if (
      arg === "--email" ||
      arg === "--phone" ||
      arg === "--alias" ||
      arg === "--handle" ||
      arg === "--company" ||
      arg === "--job-title" ||
      arg === "--contact" ||
      arg === "--name"
    ) {
      index += 1;
      continue;
    }
    if (
      [
        "--title",
        "--due",
        "--remind",
        "--notes",
        "--start",
        "--end",
        "--location",
        "--description",
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
    if (response.error.code === "UNAUTHORIZED") {
      printAuthHint("invalid");
    }
    process.exitCode = 1;
    return;
  }

  render(response.data);
}

export function persistApiUrl(apiUrl: string): void {
  saveSettings({ url: apiUrl });
}
