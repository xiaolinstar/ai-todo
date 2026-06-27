# API 错误码文档对齐 — Batch 6 Implementation Plan

> **Scope:** 文档与 skill 与 Batch 1–5 wire 实现对齐；**不改代码**。

**Goal:** 更新 `docs/api-design.md`、CLI/agent/skill/runbook 中的错误码表与示例，统一为 ADR-0005 前缀码，并注明 legacy alias。

**Out of scope:** 历史 release plan（`docs/releases/*`）保留快照；batch 0–5 plan 文档保留映射记录。

---

## 交付物

| 文件                      | 变更                                    |
| ------------------------- | --------------------------------------- |
| `docs/api-design.md`      | 按 AUTH/VAL/BIZ/SYS 分表 + legacy alias |
| `docs/cli-design.md`      | 指向前缀码表                            |
| `docs/agent-usage.md`     | JSON 示例 + 常见码                      |
| `skills/ai-todo/SKILL.md` | Errors 段                               |
| `docs/developer-guide.md` | 503 排障标题                            |
| `docs/release-runbook.md` | 迁移排障行                              |

---

## 验收

- [x] 主文档无单独 legacy 码表（legacy 仅作 alias 列）
- [x] `grep` 主文档不含未标注的 `UNAUTHORIZED` / `VALIDATION_ERROR` 等作为**当前** wire 码
