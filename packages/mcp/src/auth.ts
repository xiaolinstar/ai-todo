import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SETTINGS_PATH = path.join(os.homedir(), ".ai-todo", "settings.json");

export function resolveAuthError(): string | null {
  if (process.env.AI_TODO_TOKEN?.trim()) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Record<string, unknown>;
    if (typeof raw.token === "string" && raw.token.trim()) {
      return null;
    }
  } catch {
    // missing or unreadable settings
  }
  return (
    "ai-todo MCP requires authentication. Set AI_TODO_TOKEN (and optional AI_TODO_API_URL) " +
    `or create ${SETTINGS_PATH} with { \"url\": \"https://xingxiaolin.cn\", \"token\": \"aitodo_...\" }. ` +
    "Create a PAT in the WeChat miniapp: Mine → CLI / Agent tokens."
  );
}
