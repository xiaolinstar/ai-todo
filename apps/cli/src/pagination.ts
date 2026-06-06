import { readFlagValue } from "./context";

export const DEFAULT_LIST_LIMIT = 50;

export function readListLimit(argv: string[]): number {
  const raw = readFlagValue(argv, "--limit");
  if (!raw) {
    return DEFAULT_LIST_LIMIT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    console.error("Usage: --limit must be an integer between 1 and 100.");
    process.exitCode = 1;
    return DEFAULT_LIST_LIMIT;
  }
  return parsed;
}

export function readListCursor(argv: string[]): string | undefined {
  return readFlagValue(argv, "--cursor");
}

declare const process: { exitCode?: number };
