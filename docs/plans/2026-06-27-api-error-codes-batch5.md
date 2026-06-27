# API 错误码 SYS 族迁移 — Batch 5 Implementation Plan

> **Scope:** SYS 族 wire 切到 `SYS_*` 前缀码；完成 P0 审计 19 码 wire 迁移。

## Legacy → Wire

| 旧 wire                 | 新 wire                     |
| ----------------------- | --------------------------- |
| `DATABASE_ERROR`        | `SYS_DB_UNAVAILABLE`        |
| `INTERNAL_ERROR`        | `SYS_INTERNAL_ERROR`        |
| `HTTP_ERROR`            | `SYS_HTTP_ERROR`            |
| `WECHAT_NOT_CONFIGURED` | `SYS_WECHAT_NOT_CONFIGURED` |

## 验收

- [x] `pnpm test:api` pass
- [x] shared / miniapp typecheck pass
- [x] `apps/api/src` 无 legacy SYS 硬编码（除 `errors.py` alias 表）

## 后续

Batch 6：对齐 `docs/api-design.md` / CLI skill 文档与实现对齐。
