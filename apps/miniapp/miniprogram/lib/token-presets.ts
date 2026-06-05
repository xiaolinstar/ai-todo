export interface TokenPreset {
  id: string;
  label: string;
  description: string;
  actionLabel: string;
  ttlDays?: number;
  maxIdleDays: number;
}

export const TOKEN_PRESETS: TokenPreset[] = [
  {
    id: "daily",
    label: "日常使用",
    description: "180 天到期 · 90 天未用失效",
    actionLabel: "日常使用（180 天）",
    ttlDays: 180,
    maxIdleDays: 90
  },
  {
    id: "debug",
    label: "短期调试",
    description: "30 天到期 · 30 天未用失效",
    actionLabel: "短期调试（30 天）",
    ttlDays: 30,
    maxIdleDays: 30
  },
  {
    id: "long",
    label: "长期使用",
    description: "永不过期 · 90 天未用失效",
    actionLabel: "长期使用（不过期）",
    maxIdleDays: 90
  }
];

export function findTokenPreset(id: string): TokenPreset {
  return TOKEN_PRESETS.find((item) => item.id === id) || TOKEN_PRESETS[0];
}

export function defaultTokenName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `CLI ${year}-${month}-${day}`;
}

export function expiresAtFromDays(days?: number): string | undefined {
  if (!days) return undefined;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export function buildLoginCommand(apiUrl: string, token: string): string {
  return `ai-todo login --url ${apiUrl} --token ${token}`;
}
