# AGENTS.md

> 跨 Agent / IDE 通用项目说明。Claude Code 见 [CLAUDE.md](CLAUDE.md)（`@AGENTS.md` 复用本文件）。
> 通用标准：[`~/AgentProjects/dev-standards`](../../dev-standards) — 勿复制整份标准库进本仓库。

## 项目一句话

AI 原生的待办、日历、联系人后端 + 多端前端（小程序 / iOS / Android / 鸿蒙 / CLI / MCP）。后端不内置自然语言解析，靠结构化 CLI 与 Agent 集成。

## 仓库结构（monorepo）

```
apps/
  api/          # FastAPI 后端（Python 3.11, alembic 迁移）
  cli/          # 命令行工具（@xiaolinstar/ai-todo-cli，--json 接口）
  miniapp/      # 微信小程序（@ai-todo/miniapp，原生 + TS）
  ios/          # iOS / android/ / harmony/
packages/
  shared/ api-client/ agent-protocol/ config/ mcp/
docs/
  tech-decisions.md  miniapp-conventions.md  release-runbook.md
  deploy.md  api-design.md  data-model.md  database-migrations.md
```

## 标准库引用

| 主题              | 引用                                                             |
| ----------------- | ---------------------------------------------------------------- |
| 通用原则          | `~/AgentProjects/dev-standards/playbook/principles.md`           |
| CI 最低门槛       | `~/AgentProjects/dev-standards/playbook/ci-minimum-gate.md`      |
| Agent 配置策略    | `~/AgentProjects/dev-standards/playbook/agent-config.md`         |
| Check 免审批规则  | Skill `agent-permissions` · `sync.sh permissions --user`         |
| 微信小程序        | `~/AgentProjects/dev-standards/playbook/wechat-mp.md`            |
| API 错误码        | `~/AgentProjects/dev-standards/playbook/api-error-codes.md`      |
| Cursor 作用域规则 | `.cursor/rules/`（`sync.sh adapters cursor .` 从 playbook 派生） |

## 常用命令

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build
pnpm dev:api          # 默认 127.0.0.1:3100
pnpm test:api
pnpm cli today --json
pnpm check:wechat
pnpm miniapp:preview  # 体验版二维码；上传用微信开发者工具
```

## 分层入口

| 关注点      | 文档                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| 小程序      | [apps/miniapp/README.md](apps/miniapp/README.md) + [docs/miniapp-conventions.md](docs/miniapp-conventions.md) |
| 后端 API    | [docs/api-design.md](docs/api-design.md) + [docs/database-migrations.md](docs/database-migrations.md)         |
| 部署        | [docs/deploy.md](docs/deploy.md) + [docs/release-runbook.md](docs/release-runbook.md)                         |
| CLI / Agent | [docs/cli-design.md](docs/cli-design.md) + [docs/agent-usage.md](docs/agent-usage.md)                         |
| 技术决策    | [docs/tech-decisions.md](docs/tech-decisions.md)                                                              |

## 部署架构

```text
[小程序 / 移动端] → xiaolin-gateway → ai-todo-api (Docker) → PostgreSQL / Redis
```

- 生产域名 `xingxiaolin.cn` 不在小程序源码硬编码
- 真实小程序 AppID、上传密钥不入库

## CI/CD

CI：scan → build → test → publish-manifest（[.github/workflows/ci.yml](.github/workflows/ci.yml)）  
CD：含自动回滚（[docs/release-runbook.md](docs/release-runbook.md)）

## 本地 Git hooks

首次拉代码：`pnpm install --frozen-lockfile`（激活 Husky）

| Hook         | 行为                               |
| ------------ | ---------------------------------- |
| `pre-commit` | gitleaks（可降级）+ lint-staged    |
| `commit-msg` | commitlint（Conventional Commits） |

## 不要做的事

- ❌ 提交密钥、`ci.env`、`project.private.config.json`、`apps/api/.env`
- ❌ 小程序硬编码真实 AppID
- ❌ 跳过 lint / typecheck / test
- ❌ alembic 迁移无 schema 校验脚本
- ❌ 复制整份 dev-standards 进本仓库
- ❌ 非紧急使用 `git commit --no-verify`
