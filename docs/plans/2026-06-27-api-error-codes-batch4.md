# API 错误码 BIZ 族迁移 — Batch 4 Implementation Plan

> **Scope:** BIZ 族 wire 切到 `BIZ_*` 前缀码；delivery `errorCode` 字段同步；客户端 legacy alias 一期。

## Legacy → Wire

| 旧 wire                      | 新 wire                          |
| ---------------------------- | -------------------------------- |
| `NOT_FOUND`                  | `BIZ_NOT_FOUND`                  |
| `CONTACT_NOT_FOUND`          | `BIZ_CONTACT_NOT_FOUND`          |
| `IDEMPOTENCY_CONFLICT`       | `BIZ_IDEMPOTENCY_CONFLICT`       |
| `REMINDER_INACTIVE`          | `BIZ_REMINDER_INACTIVE`          |
| `REMINDER_NO_SCHEDULE`       | `BIZ_REMINDER_NO_SCHEDULE`       |
| `CALENDAR_EVENT_INACTIVE`    | `BIZ_CALENDAR_EVENT_INACTIVE`    |
| `CALENDAR_EVENT_NO_SCHEDULE` | `BIZ_CALENDAR_EVENT_NO_SCHEDULE` |
| `WECHAT_OPENID_MISSING`      | `BIZ_WECHAT_OPENID_MISSING`      |
| `INVALID_TARGET`             | `BIZ_INVALID_TARGET`             |

## 验收

- [x] `pnpm test:api` pass
- [x] shared / miniapp typecheck pass
