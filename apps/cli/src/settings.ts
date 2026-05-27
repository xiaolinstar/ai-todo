import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** On-disk shape for ~/.ai-todo/settings.json */
export interface CliSettings {
  url?: string;
  token?: string;
}

const SETTINGS_DIR = path.join(os.homedir(), ".ai-todo");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");
const LEGACY_CONFIG_PATH = path.join(SETTINGS_DIR, "config.json");

function normalizeSettings(raw: Record<string, unknown>): CliSettings {
  const url =
    typeof raw.url === "string"
      ? raw.url
      : typeof raw.apiUrl === "string"
        ? raw.apiUrl
        : undefined;
  const token = typeof raw.token === "string" ? raw.token : undefined;
  return { url, token };
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeSettingsFile(settings: CliSettings): void {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  try {
    fs.chmodSync(SETTINGS_PATH, 0o600);
  } catch {
    // best-effort on platforms without chmod
  }
}

export function settingsPath(): string {
  return SETTINGS_PATH;
}

export function loadSettings(): CliSettings {
  const current = readJsonFile(SETTINGS_PATH);
  if (current) {
    return normalizeSettings(current);
  }

  const legacy = readJsonFile(LEGACY_CONFIG_PATH);
  if (legacy) {
    const migrated = normalizeSettings(legacy);
    writeSettingsFile(migrated);
    return migrated;
  }

  return {};
}

export function saveSettings(patch: CliSettings): void {
  const current = loadSettings();
  const next: CliSettings = { ...current, ...patch };
  writeSettingsFile(next);
}

export function clearToken(): void {
  const current = loadSettings();
  const { token: _removed, ...rest } = current;
  writeSettingsFile(rest);
}

export function resolveApiUrl(settings: CliSettings = loadSettings()): string {
  const fromEnv = process.env.AI_TODO_API_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = settings.url?.trim();
  if (fromFile) {
    return fromFile;
  }

  return "http://127.0.0.1:3100";
}

declare const process: {
  env: Record<string, string | undefined>;
};
