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

function settingsExample(apiUrl = "https://wodi.games"): string {
  return JSON.stringify({ url: apiUrl, token: "aitodo_xxx" }, null, 2);
}

export function printAuthHint(reason: "missing" | "invalid" = "missing"): void {
  const settingsFile = settingsPath();
  const lines =
    reason === "invalid"
      ? [
          "API Token 无效或已过期。",
          "",
          "请更新 Personal Access Token（PAT）：",
          "",
          `编辑 ${settingsFile}：`,
          settingsExample(),
          "",
          "Agent / CI 也可使用环境变量（优先级高于配置文件）：",
          "  export AI_TODO_TOKEN=aitodo_xxx",
          "  export AI_TODO_API_URL=https://wodi.games",
          "",
          "生产环境请在微信小程序「我的 → CLI / Agent 访问令牌」创建新 PAT。"
        ]
      : [
          "未检测到 API Token。",
          "",
          "首次配置：创建 ~/.ai-todo/settings.json",
          "",
          settingsExample(),
          "",
          "1. 微信小程序 → 我的 → CLI / Agent 访问令牌 → 创建",
          "2. 将完整 token 填入上述文件的 token 字段",
          "3. 运行 ai-todo whoami 验证",
          "",
          `配置文件路径：${settingsFile}`
        ];

  for (const line of lines) {
    console.error(line);
  }
}

declare const process: {
  env: Record<string, string | undefined>;
};
