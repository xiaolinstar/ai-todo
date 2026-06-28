# API 错误码迁移 — Release Notes

**Git tag：** [`api-error-codes-migration-complete`](https://github.com/xiaolinstar/ai-todo/releases/tag/api-error-codes-migration-complete)  
**发布日期：** 2026-06-27  
**标准：** [dev-standards ADR-0005](https://github.com/xiaolinstar/dev-standards/blob/main/playbook/adr/0005-api-error-code-convention.md)

## 概要

完成 P0 审计驱动的 **Batch 0–6**：JSON 响应关联 ID、集中 `ErrorCode` 枚举、19 个 legacy wire 码全部切换为 `AUTH_*` / `VAL_*` / `BIZ_*` / `SYS_*` 前缀，CLI/小程序保留 legacy alias 匹配一期，文档与实现对齐。

**非破坏性：** envelope 形状 `{ ok, error, requestId, traceId }` 不变；客户端通过 `@ai-todo/shared` / 小程序 `error-codes.ts` 的 `matches*ErrorCode` 仍识别旧码。

## 组件影响

| 组件              | 变更                                                 |
| ----------------- | ---------------------------------------------------- |
| API (`apps/api`)  | `errors.py` 真源；wire 前缀码；116 pytest pass       |
| `@ai-todo/shared` | `errors.ts`：AUTH/VAL/BIZ/SYS matcher + legacy alias |
| CLI               | `context.ts` 等使用 shared matcher                   |
| 微信小程序        | `lib/error-codes.ts`（bundle 隔离副本）              |
| 文档              | `docs/api-design.md` §错误码、agent/skill/runbook    |

## Wire 变更摘要

| 前缀 | 示例（新 → 旧 alias）                    |
| ---- | ---------------------------------------- |
| AUTH | `AUTH_INVALID_TOKEN` ← `UNAUTHORIZED`    |
| VAL  | `VAL_INVALID_INPUT` ← `VALIDATION_ERROR` |
| BIZ  | `BIZ_NOT_FOUND` ← `NOT_FOUND`            |
| SYS  | `SYS_DB_UNAVAILABLE` ← `DATABASE_ERROR`  |

完整映射见 `docs/plans/2026-06-27-api-error-codes-batch1.md` 与各 batch plan。

## Batch 时间线

| Batch | 内容                           | 关键 commit（main）             |
| ----- | ------------------------------ | ------------------------------- |
| 0     | 响应体 `requestId` + `traceId` | Batch 0 系列（见 tag 之前历史） |
| 1     | `errors.py` 枚举 + legacy 表   | `a5cd09e`                       |
| 2     | AUTH wire + 客户端双码         | `9a931aa`, `f84ddd5`            |
| 3     | VAL wire                       | `a968b29`                       |
| 4     | BIZ wire                       | `413dca9`                       |
| 5     | SYS wire                       | `59d43be`                       |
| 6     | 文档对齐                       | `20ed0aa`                       |

## 验收

```bash
cd apps/api && .venv/bin/python -m pytest -q          # 116 passed
pnpm --filter @ai-todo/shared build
pnpm --filter @ai-todo/miniapp typecheck
```

## 后续

- Planned-only 码（未实现 wire）：`BIZ_CONTACT_AMBIGUOUS`、`VAL_CONTACT_METHOD_REQUIRED`、`BIZ_CONFIRMATION_REQUIRED`
- 下一审计周期可评估是否移除 legacy alias（需 CLI/小程序/Agent 全量切换）

## 参考

- 真源代码：`apps/api/src/ai_todo_api/errors.py`、`packages/shared/src/errors.ts`
- HTTP 契约：`docs/api-design.md` §错误码
- 实施计划：`docs/plans/2026-06-27-api-error-codes-batch*.md`
