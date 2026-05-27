import { configPath, loadConfig } from "./config";

export type TokenSource = "env" | "config" | "none";

export function resolveTokenSource(): { token?: string; source: TokenSource } {
  const envToken = process.env.AI_TODO_TOKEN?.trim();
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  const configToken = loadConfig().token?.trim();
  if (configToken) {
    return { token: configToken, source: "config" };
  }

  return { source: "none" };
}

export function printAuthHint(reason: "missing" | "invalid" = "missing"): void {
  const lines =
    reason === "invalid"
      ? [
          "API Token 无效或已过期。",
          "",
          "请重新配置 Personal Access Token（PAT）：",
          "  export AI_TODO_TOKEN=aitodo_xxx          # 推荐：写入 shell 配置或 Agent 环境",
          "  ai-todo login --token aitodo_xxx         # 或保存到 ~/.ai-todo/config.json",
          "",
          "本地开发（127.0.0.1）可一次性签发 PAT：",
          "  ai-todo login --issue-pat",
          "",
          "生产环境请在微信小程序「我的 → CLI / Agent 访问令牌」创建 PAT。"
        ]
      : [
          "未检测到 API Token。",
          "",
          "Agent / CLI 推荐使用 PAT（类似 OPENAI_API_KEY）：",
          "  export AI_TODO_TOKEN=aitodo_xxx",
          "  ai-todo login --token aitodo_xxx",
          "",
          "本地开发（127.0.0.1）可一次性签发 PAT：",
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
