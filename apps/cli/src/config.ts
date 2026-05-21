import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface CliConfig {
  apiUrl?: string;
  token?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".ai-todo");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function loadConfig(): CliConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

export function saveConfig(patch: CliConfig): void {
  const current = loadConfig();
  const next = { ...current, ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function clearToken(): void {
  const current = loadConfig();
  const { token: _removed, ...rest } = current;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(rest, null, 2)}\n`, "utf8");
}

export function configPath(): string {
  return CONFIG_PATH;
}
