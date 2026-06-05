import { ApiTokenSummary } from "./api";
import { formatShortDate } from "./format";

export type TokenStatus = ApiTokenSummary["status"];

export const TOKEN_STATUS_LABELS: Record<string, string> = {
  active: "有效",
  expired: "已过期",
  revoked: "已吊销",
  idle_revoked: "久未使用失效"
};

type RawTokenFields = {
  status?: string;
  revokedAt?: string;
  revoked_at?: string;
  expiresAt?: string;
  expires_at?: string;
  maxIdleDays?: number;
  max_idle_days?: number;
  createdAt?: string;
  created_at?: string;
  lastUsedAt?: string;
  last_used_at?: string;
};

export function normalizeApiTokenSummary<T extends RawTokenFields>(item: T): ApiTokenSummary & T {
  const revokedAt = item.revokedAt ?? item.revoked_at;
  const expiresAt = item.expiresAt ?? item.expires_at;
  const maxIdleDays = item.maxIdleDays ?? item.max_idle_days;
  const createdAt = item.createdAt ?? item.created_at;
  const lastUsedAt = item.lastUsedAt ?? item.last_used_at;
  const status = resolveTokenStatus({
    status: item.status,
    revokedAt,
    expiresAt,
    maxIdleDays,
    createdAt,
    lastUsedAt
  });

  return {
    ...item,
    status,
    revokedAt,
    expiresAt,
    maxIdleDays,
    createdAt,
    lastUsedAt
  };
}

export function resolveTokenStatus(item: RawTokenFields): TokenStatus {
  const known = item.status;
  if (known && known in TOKEN_STATUS_LABELS) {
    return known as TokenStatus;
  }

  const revokedAt = item.revokedAt ?? item.revoked_at;
  if (revokedAt) {
    return "revoked";
  }

  const now = Date.now();
  const expiresAt = item.expiresAt ?? item.expires_at;
  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs < now) {
      return "expired";
    }
  }

  const maxIdleDays = item.maxIdleDays ?? item.max_idle_days;
  const activityAt = item.lastUsedAt ?? item.last_used_at ?? item.createdAt ?? item.created_at;
  if (maxIdleDays && activityAt) {
    const activityMs = Date.parse(activityAt);
    if (!Number.isNaN(activityMs)) {
      const idleCutoffMs = activityMs + maxIdleDays * 24 * 60 * 60 * 1000;
      if (idleCutoffMs < now) {
        return "idle_revoked";
      }
    }
  }

  return "active";
}

export function isActiveTokenStatus(status: string): boolean {
  return status === "active";
}

export function tokenStatusClass(status: string): string {
  if (status === "active") return "status-active";
  if (status === "idle_revoked") return "status-warning";
  return "status-muted";
}

function formatOptionalDate(value?: string): string {
  return value ? formatShortDate(value) : "";
}

function idleDeadlineLabel(item: Pick<ApiTokenSummary, "createdAt" | "lastUsedAt" | "maxIdleDays">): string {
  if (!item.maxIdleDays) return "";
  const activityAt = item.lastUsedAt || item.createdAt;
  if (!activityAt) return "";
  const activityMs = Date.parse(activityAt);
  if (Number.isNaN(activityMs)) return "";
  return formatShortDate(new Date(activityMs + item.maxIdleDays * 24 * 60 * 60 * 1000).toISOString());
}

export function buildTokenInactiveSummary(item: ApiTokenSummary): string {
  if (item.status === "revoked") {
    const revokedAt = formatOptionalDate(item.revokedAt);
    return revokedAt ? `于 ${revokedAt} 手动吊销` : "已手动吊销";
  }
  if (item.status === "expired") {
    const expiresAt = formatOptionalDate(item.expiresAt);
    return expiresAt ? `于 ${expiresAt} 到期` : "已到期";
  }
  if (item.status === "idle_revoked") {
    const idleDays = item.maxIdleDays ? `${item.maxIdleDays} 天未使用` : "长期未使用";
    const lastUsedAt = item.lastUsedAt ? formatShortDate(item.lastUsedAt) : "从未使用";
    const deadline = idleDeadlineLabel(item);
    const deadlineText = deadline ? `，${deadline} 起不可用` : "";
    return `${idleDays}（最后使用 ${lastUsedAt}${deadlineText}）`;
  }
  return TOKEN_STATUS_LABELS[item.status] || item.status;
}
