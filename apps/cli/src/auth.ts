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

export function printAuthHint(reason: "missing" | "invalid" = "missing"): void {
  const settingsFile = settingsPath();
  const lines =
    reason === "invalid"
      ? [
          "API Token 无效或已过期。",
          "",
          "请重新配置 Personal Access Token（PAT）：",
          "  ai-todo login --url https://wodi.games --token aitodo_xxx",
          "  或编辑 ~/.ai-todo/settings.json（见 apps/cli/settings.example.json）",
          "",
          "Agent 环境也可使用环境变量（优先级高于配置文件）：",
          "  export AI_TODO_TOKEN=aitodo_xxx",
          "  export AI_TODO_API_URL=https://wodi.games",
          "",
          "本地开发（127.0.0.1）可一次性签发 PAT：",
          "  ai-todo login --issue-pat",
          "",
          "生产环境请在微信小程序「我的 → CLI / Agent 访问令牌」创建 PAT。"
        ]
      : [
          "未检测到 API Token。",
          "",
          "首次配置（推荐，一次写入 ~/.ai-todo/settings.json）：",
          "  ai-todo login --url https://wodi.games --token aitodo_xxx",
          "",
          `或手动创建 ${settingsFile}：`,
          '  { "url": "https://wodi.games", "token": "aitodo_xxx" }',
          "",
          "本地开发（127.0.0.1）：",
          "  ai-todo login --issue-pat",
          "",
          "生产环境请在微信小程序「我的 → CLI / Agent 访问令牌」创建 PAT。"
        ];

  for (const line of lines) {
    console.error(line);
  }
}

declare const process: {
  env: Record<string, string | undefined>;
};
