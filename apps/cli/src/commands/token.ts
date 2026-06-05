import type { ApiTokenSummary, CreateApiTokenInput } from "@ai-todo/shared";

import type { CliContext } from "../context";
import { handleApi, readFlagValue } from "../context";

function readTokenName(argv: string[]): string | undefined {
  return readFlagValue(argv, "--name");
}

function readMaxIdleDays(argv: string[]): number | undefined {
  const raw = readFlagValue(argv, "--max-idle-days");
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--max-idle-days must be a positive integer.");
  }
  return value;
}

function readScopes(argv: string[]): string[] | undefined {
  const raw = readFlagValue(argv, "--scopes");
  if (!raw) {
    return undefined;
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusLabel(status: ApiTokenSummary["status"]): string {
  switch (status) {
    case "active":
      return "有效";
    case "expired":
      return "已过期";
    case "idle_revoked":
      return "久未使用失效";
    case "revoked":
      return "已吊销";
    default:
      return status;
  }
}

function formatDate(value?: string): string {
  return value ?? "-";
}

export async function runTokenList(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.listApiTokens(), (data) => {
    if (ctx.json) {
      return;
    }
    if (data.items.length === 0) {
      console.log("暂无访问令牌。");
      return;
    }
    for (const item of data.items) {
      console.log(`${item.id}  ${item.name}  ${statusLabel(item.status)}`);
      console.log(`  提示：${item.tokenHint ?? "aitodo_****"}`);
      console.log(`  创建：${formatDate(item.createdAt)}  最后使用：${formatDate(item.lastUsedAt)}`);
      console.log(
        `  到期：${formatDate(item.expiresAt)}  空闲失效：${
          item.maxIdleDays ? `${item.maxIdleDays} 天` : "-"
        }`
      );
    }
  });
}

export async function runTokenCreate(ctx: CliContext, argv: string[]): Promise<void> {
  const name = readTokenName(argv);
  if (!name) {
    console.error("Usage: ai-todo token create --name <text> [--expires-at <iso>] [--max-idle-days <days>]");
    process.exitCode = 1;
    return;
  }

  let maxIdleDays: number | undefined;
  try {
    maxIdleDays = readMaxIdleDays(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid --max-idle-days.");
    process.exitCode = 1;
    return;
  }

  const input: CreateApiTokenInput = {
    name,
    scopes: readScopes(argv),
    expiresAt: readFlagValue(argv, "--expires-at"),
    maxIdleDays
  };

  await handleApi(ctx, await ctx.client.createApiToken(input), (data) => {
    if (ctx.json) {
      return;
    }
    console.log("已创建访问令牌（仅显示一次，请妥善保管）：");
    console.log("");
    console.log(data.token);
    console.log("");
    console.log(`ID：${data.id}`);
    console.log(`名称：${data.name}`);
    console.log(`到期：${data.expiresAt ?? "-"}`);
    console.log(`空闲失效：${data.maxIdleDays ? `${data.maxIdleDays} 天` : "-"}`);
  });
}

export async function runTokenRevoke(ctx: CliContext, argv: string[]): Promise<void> {
  const tokenId = argv[2];
  if (!tokenId) {
    console.error("Usage: ai-todo token revoke <token_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.revokeApiToken(tokenId), (data) => {
    if (!ctx.json) {
      console.log(`已吊销访问令牌：${data.id}`);
    }
  });
}

export async function runTokenRevokeAll(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.revokeAllApiTokens(), (data) => {
    if (!ctx.json) {
      console.log(`已吊销 ${data.revokedCount} 个访问令牌。`);
    }
  });
}

declare const process: {
  exitCode?: number;
};
