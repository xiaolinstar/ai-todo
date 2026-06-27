# API 错误码 AUTH 族迁移 — Batch 2 Implementation Plan

> **Scope:** AUTH 族 wire 切到 `AUTH_*` 前缀码；CLI/miniapp 保留 legacy alias 匹配一期。

**Goal:** `auth/deps.py`、`rate_limit.py`、`api_tokens/router.py` 响应体 emit `AUTH_*`；客户端用 `matchesAuthErrorCode` / `isUnauthorizedError` 同时识别旧码。

**Out of scope:** VAL / BIZ / SYS 族（Batch 3–5）；`docs/api-design.md` 表对齐（Batch 6）。

---

## 变更摘要

| 区域                              | 变更                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `errors.py`                       | `wire_code()`、`matches_error_code()`、`error_detail()` |
| API AUTH                          | 4 码 wire → `AUTH_*`                                    |
| `packages/shared/src/errors.ts`   | TS 双码匹配 helper                                      |
| `apps/miniapp/.../error-codes.ts` | 同上（bundle 隔离副本）                                 |
| CLI                               | `context.ts` / `core.ts` 用 shared helper               |
| pytest                            | AUTH 断言切前缀码                                       |

## Legacy → Wire（Batch 2）

| 旧 wire                     | 新 wire              |
| --------------------------- | -------------------- |
| `UNAUTHORIZED`              | `AUTH_INVALID_TOKEN` |
| `FORBIDDEN`                 | `AUTH_FORBIDDEN`     |
| `SESSION_TOKEN_NOT_ALLOWED` | `AUTH_SCOPE_DENIED`  |
| `RATE_LIMITED`              | `AUTH_RATE_LIMITED`  |

客户端仍接受左列 legacy 字符串（通过 alias 表）。

---

## 验收

- [x] `pytest tests/test_errors.py tests/auth/` pass
- [x] `pnpm test:api` pass
- [x] `pnpm --filter @ai-todo/shared typecheck` pass
- [x] miniapp `pnpm typecheck` pass
