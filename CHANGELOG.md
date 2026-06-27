# Changelog

ai-todo 的版本变更记录。**双版本**策略：

- 仓库根 `package.json` 的 `version` → monorepo 整体（`v0.4.0` 当前）
- `apps/miniapp/package.json` 的 `version` → 小程序独立（`v0.8.3` 当前）

子包独立版本（小程序、CLI、MCP）随各自发布节奏，详见 `git tag --list` 与子包 `CHANGELOG.md`（如有）。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

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
