# Changelog

ai-todo 的版本变更记录。**双版本**策略：

- 仓库根 `package.json` 的 `version` → monorepo 整体（`v0.4.0` 当前）
- `apps/miniapp/package.json` 的 `version` → 小程序独立（`v0.8.7` 当前）

子包独立版本（API `0.5.0`、CLI `0.7.0`、MCP `0.3.0`、小程序 `0.8.7`）随各自发布节奏，详见 `git tag --list` 与子包 `CHANGELOG.md`（如有）。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.8.14](https://github.com/xiaolinstar/ai-todo/compare/v0.8.13...v0.8.14) (2026-07-12)


### Bug Fixes

* **cd:** require manual deployment trigger ([1c17cf9](https://github.com/xiaolinstar/ai-todo/commit/1c17cf975187eb5f84ecb7e98fab2ebda8f95665))

## [Unreleased]

### Added

- docs: 根 CLAUDE.md 与 `apps/miniapp/CLAUDE.md` 项目级 Agent 引导
- ci(playbook): 0-scan · Secret scan (gitleaks)，阻断式门禁
- apps/miniapp: ESLint + Prettier（`pnpm lint` / `pnpm format:check`）
- apps/miniapp: `pnpm bump-version` 脚本，自动同步 `package.json` ↔ `lib/version.ts`
- chore(hooks): Husky 9 + lint-staged + commitlint
  - `.husky/pre-commit`: gitleaks（本地未装时降级，CI 兜底）+ lint-staged（eslint --fix + prettier --write）
  - `.husky/commit-msg`: commitlint 强制 conventional commits
  - `commitlint.config.cjs`: type 限定为 `feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert`

## [api-error-codes-migration] - 2026-06-27

Tag：`api-error-codes-migration-complete`。详见 [docs/releases/api-error-codes-migration.md](docs/releases/api-error-codes-migration.md)。

### Changed

- **API 错误码（ADR-0005）**：19 个 legacy wire 码迁移为 `AUTH_*` / `VAL_*` / `BIZ_*` / `SYS_*` 前缀
- **关联 ID**：所有 JSON 响应体含 `requestId` 与 `traceId`（与 `X-Request-ID` 同值）
- **客户端**：CLI / 小程序 / `@ai-todo/shared` 通过 matcher 兼容旧码 alias

### Added

- `apps/api/src/ai_todo_api/errors.py` — 集中枚举与 `LEGACY_ERROR_ALIASES`
- `packages/shared/src/errors.ts` — TS 侧 `matches*ErrorCode` / `is*Error`
- `docs/plans/2026-06-27-api-error-codes-batch*.md` — Batch 0–6 实施记录

## 完整历史

完整 release 历史见 `git tag --list` 与 `git log --oneline`。

| 区间   | 关键节点                                   |
| ------ | ------------------------------------------ |
| v0.1.x | 项目起步                                   |
| v0.2.x | API + 微信小程序 MVP                       |
| v0.3.x | 多端（iOS / Android / 鸿蒙）               |
| v0.4.x | FastAPI + alembic + GitHub Actions CI/CD   |
| v0.5.x | MCP 集成（`@xiaolinstar/ai-todo-mcp`）     |
| v0.6.x | 发布 manifest + CD 自动化                  |
| v0.7.x | UX 稳定                                    |
| v0.8.x | 小程序：环境分桶认证 + 通知设置 + 隐私协议 |
