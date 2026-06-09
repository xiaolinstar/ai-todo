import { loadSettings, settingsPath } from "./settings";

export type TokenSource = "env" | "settings" | "none";

export function resolveTokenSource(): { token?: string; source: TokenSource } {
  const envToken = process.env.AI_TODO_TOKEN?.trim();
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  const settingsToken = loadSettings().token?.trim();
  if (settingsToken) {
    return { token: settingsToken, source: "settings" };
  }

  return { source: "none" };
}

function settingsExample(apiUrl = "https://xingxiaolin.cn"): string {
  return JSON.stringify({ url: apiUrl, token: "aitodo_xxx" }, null, 2);
}

export function printAuthHint(reason: "missing" | "invalid" = "missing"): void {
  const settingsFile = settingsPath();
  const lines =
    reason === "invalid"
      ? [
          "The API token is invalid or expired.",
          "",
          "Update your Personal Access Token (PAT):",
          "",
          `Edit ${settingsFile}:`,
          settingsExample(),
          "",
          "Agents and CI can also use environment variables, which override the settings file:",
          "  export AI_TODO_TOKEN=aitodo_xxx",
          "  export AI_TODO_API_URL=https://xingxiaolin.cn",
          "",
          "For production, create a new PAT in the WeChat miniapp: Mine -> CLI / Agent access tokens."
        ]
      : [
          "No API token configured.",
          "",
          "First-time setup: create ~/.ai-todo/settings.json",
          "",
          settingsExample(),
          "",
          "1. Open the WeChat miniapp: Mine -> CLI / Agent access tokens -> Create",
          "2. Paste the full token into the token field in the settings file",
          "3. Run ai-todo whoami to verify the setup",
          "",
          `Settings path: ${settingsFile}`
        ];

  for (const line of lines) {
    console.error(line);
  }
}

declare const process: {
  env: Record<string, string | undefined>;
};
