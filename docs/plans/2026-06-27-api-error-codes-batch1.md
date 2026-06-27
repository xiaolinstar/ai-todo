# API 错误码集中枚举 — Batch 1 Implementation Plan

> **For agentic workers:** Batch 1 is infrastructure only — **no wire `error.code` changes**.

**Goal:** 新建 `apps/api/src/ai_todo_api/errors.py`，集中定义 ADR-0005 前缀码 + 19 个存量 legacy alias；为 Batch 2–5 迁移提供唯一真源。

**Architecture:** `ErrorCode` StrEnum 存放 canonical 前缀码；`LEGACY_ERROR_ALIASES` 映射旧 wire 字符串 → canonical；`legacy_wire_code()` 在迁移期返回旧码；`canonical_code()` 解析旧码。

**Spec:** P0 只读审计（2026-06-27）；`~/AgentProjects/dev-standards/playbook/api-error-codes.md` + ADR-0005。

**Out of scope:** 修改 handler/router 的 wire 响应（Batch 2–5）；CLI/miniapp 客户端分支；`docs/api-design.md` 错误码表对齐（Batch 6）。

---

## 交付物

| 文件                                 | 职责                                               |
| ------------------------------------ | -------------------------------------------------- |
| `apps/api/src/ai_todo_api/errors.py` | `ErrorCode` 枚举、`LEGACY_ERROR_ALIASES`、辅助函数 |
| `apps/api/tests/test_errors.py`      | 前缀校验、alias 双向、P0 清单、源码硬编码扫描      |

---

## Legacy → Canonical 映射（P0 审计）

| Legacy                       | Canonical                        | 前缀 |
| ---------------------------- | -------------------------------- | ---- |
| `UNAUTHORIZED`               | `AUTH_INVALID_TOKEN`             | AUTH |
| `FORBIDDEN`                  | `AUTH_FORBIDDEN`                 | AUTH |
| `SESSION_TOKEN_NOT_ALLOWED`  | `AUTH_SCOPE_DENIED`              | AUTH |
| `RATE_LIMITED`               | `AUTH_RATE_LIMITED`              | AUTH |
| `VALIDATION_ERROR`           | `VAL_INVALID_INPUT`              | VAL  |
| `INVALID_CURSOR`             | `VAL_INVALID_CURSOR`             | VAL  |
| `NOT_FOUND`                  | `BIZ_NOT_FOUND`                  | BIZ  |
| `CONTACT_NOT_FOUND`          | `BIZ_CONTACT_NOT_FOUND`          | BIZ  |
| `IDEMPOTENCY_CONFLICT`       | `BIZ_IDEMPOTENCY_CONFLICT`       | BIZ  |
| `REMINDER_INACTIVE`          | `BIZ_REMINDER_INACTIVE`          | BIZ  |
| `REMINDER_NO_SCHEDULE`       | `BIZ_REMINDER_NO_SCHEDULE`       | BIZ  |
| `CALENDAR_EVENT_INACTIVE`    | `BIZ_CALENDAR_EVENT_INACTIVE`    | BIZ  |
| `CALENDAR_EVENT_NO_SCHEDULE` | `BIZ_CALENDAR_EVENT_NO_SCHEDULE` | BIZ  |
| `WECHAT_OPENID_MISSING`      | `BIZ_WECHAT_OPENID_MISSING`      | BIZ  |
| `INVALID_TARGET`             | `BIZ_INVALID_TARGET`             | BIZ  |
| `DATABASE_ERROR`             | `SYS_DB_UNAVAILABLE`             | SYS  |
| `INTERNAL_ERROR`             | `SYS_INTERNAL_ERROR`             | SYS  |
| `HTTP_ERROR`                 | `SYS_HTTP_ERROR`                 | SYS  |
| `WECHAT_NOT_CONFIGURED`      | `SYS_WECHAT_NOT_CONFIGURED`      | SYS  |

**Planned-only（文档有、代码未实现）：** `BIZ_CONTACT_AMBIGUOUS`、`VAL_CONTACT_METHOD_REQUIRED`、`BIZ_CONFIRMATION_REQUIRED` — 已在枚举中预留，无 legacy alias。

---

## 后续批次

| 批次  | 范围                                                       | 风险 |
| ----- | ---------------------------------------------------------- | ---- |
| **2** | AUTH 族 wire 切到前缀码（CLI/miniapp 保留旧码 alias 一期） | 中   |
| **3** | VAL 族                                                     | 中   |
| **4** | BIZ 族                                                     | 中   |
| **5** | SYS 族 + 淘汰 `HTTP_ERROR`                                 | 低   |
| **6** | 文档与实现对齐                                             | 低   |

---

## 验收

- [x] `pytest tests/test_errors.py` pass
- [x] `pnpm test:api` pass（全量回归）
- [x] 无 handler wire 字符串变更（`git diff` 仅 `errors.py` + tests + plan）
