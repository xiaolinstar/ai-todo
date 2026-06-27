# API 错误码 VAL 族迁移 — Batch 3 Implementation Plan

> **Scope:** VAL 族 wire 切到 `VAL_*` 前缀码；客户端保留 legacy alias 匹配一期。

**Goal:** 全局 handler + 各 router 的 `VALIDATION_ERROR` / `INVALID_CURSOR` 改为 `VAL_INVALID_INPUT` / `VAL_INVALID_CURSOR`；miniapp 版本过旧提示逻辑兼容双码。

## Legacy → Wire

| 旧 wire            | 新 wire              |
| ------------------ | -------------------- |
| `VALIDATION_ERROR` | `VAL_INVALID_INPUT`  |
| `INVALID_CURSOR`   | `VAL_INVALID_CURSOR` |

## 验收

- [x] `pnpm test:api` pass
- [x] miniapp / shared typecheck pass
