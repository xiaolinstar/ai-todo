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
const PRODUCTION_API_URL = "https://xingxiaolin.cn";
/** 本地 K8s + xiaolin-gateway（HTTP :8880 → 宿主机 :8082） */
export const LOCAL_GATEWAY_API_URL = "http://ai-todo-api.localhost:8880";
const LEGACY_LOCAL_API_URLS = [
  "http://localhost:8880",
  "http://ai-todo-api.local:8880",
  "http://ai-todo.localhost:8880",
  "http://127.0.0.1:3100",
] as const;

function normalizeApiUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/wodi\.games/i.test(trimmed)) {
    return PRODUCTION_API_URL;
  }
  if ((LEGACY_LOCAL_API_URLS as readonly string[]).includes(trimmed)) {
    return LOCAL_GATEWAY_API_URL;
  }
  return trimmed;
}

function normalizeSettings(raw: Record<string, unknown>): CliSettings {
  const url = normalizeApiUrl(
    typeof raw.url === "string"
      ? raw.url
      : typeof raw.apiUrl === "string"
        ? raw.apiUrl
        : undefined
  );
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
    const settings = normalizeSettings(current);
    const rawUrl =
      typeof current.url === "string"
        ? current.url
        : typeof current.apiUrl === "string"
          ? current.apiUrl
          : undefined;
    if (rawUrl && normalizeApiUrl(rawUrl) !== rawUrl.trim()) {
      writeSettingsFile(settings);
    }
    return settings;
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
  const fromEnv = normalizeApiUrl(process.env.AI_TODO_API_URL);
  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = normalizeApiUrl(settings.url);
  if (fromFile) {
    return fromFile;
  }

  return LOCAL_GATEWAY_API_URL;
}

declare const process: {
  env: Record<string, string | undefined>;
};
