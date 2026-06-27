# CLAUDE.md

> 项目级 Agent 引导。**通用标准在 [`~/AgentProjects/dev-standards`](../../../../../dev-standards)**,不要把整份标准库复制到本仓库。

## 项目一句话

AI 原生的待办、日历、联系人后端 + 多端前端（小程序 / iOS / Android / 鸿蒙 / CLI / MCP）。后端不内置自然语言解析，靠结构化 CLI 与 Agent 集成。

## 仓库结构（monorepo）

```
apps/
  api/          # FastAPI 后端（Python 3.11, alembic 迁移）
  cli/          # 命令行工具（@xiaolinstar/ai-todo-cli，--json 接口）
  miniapp/      # 微信小程序（@ai-todo/miniapp，原生 + TS）
  ios/          # iOS 应用
  android/      # Android 应用
  harmony/      # 鸿蒙应用
packages/
  shared/         # @ai-todo/shared
  api-client/     # @ai-todo/api-client
  agent-protocol/ # @ai-todo/agent-protocol
  config/         # 共享配置
  mcp/            # @xiaolinstar/ai-todo-mcp
docs/
  tech-decisions.md          # 技术决策（与 ADR 类似）
  miniapp-conventions.md     # 微信小程序项目级规范
  release-runbook.md         # 发布手册
  deploy.md / deploy-troubleshooting.md
  api-design.md / data-model.md / database-migrations.md
```

## 标准库引用

| 主题           | 引用                                                        |
| -------------- | ----------------------------------------------------------- |
| 通用原则       | `~/AgentProjects/dev-standards/playbook/principles.md`      |
| CI 最低门槛    | `~/AgentProjects/dev-standards/playbook/ci-minimum-gate.md` |
| 微信小程序标准 | `~/AgentProjects/dev-standards/playbook/wechat-mp.md`       |
| API 错误码     | `~/AgentProjects/dev-standards/playbook/api-error-codes.md` |
| ADR            | `~/AgentProjects/dev-standards/playbook/adr/`               |

## 常用命令

```bash
# 安装
pnpm install --frozen-lockfile

# 单层检查（CI 走的就是这套）
pnpm typecheck        # pnpm -r typecheck
pnpm lint             # pnpm -r lint
pnpm build            # pnpm -r build

# 后端
pnpm dev:api          # apps/api/.venv/bin/python -m ai_todo_api（默认 127.0.0.1:3100）
pnpm test:api         # 87%+ 覆盖率，按 apps/api/tests/ 业务模块组织

# CLI
pnpm cli today --json

# 微信小程序
pnpm check:wechat     # typecheck + build:check + check-wechat-miniprogram
pnpm miniapp:preview  # 生成体验版二维码
# pnpm miniapp:upload  # 暂不启用（IP 白名单与运维习惯原因）→ 用微信开发者工具上传
```

## 分层入口

| 关注点           | 去看                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 小程序开发       | [apps/miniapp/CLAUDE.md](apps/miniapp/CLAUDE.md) + [apps/miniapp/README.md](apps/miniapp/README.md) + [docs/miniapp-conventions.md](docs/miniapp-conventions.md) |
| 后端 API         | [apps/api/](apps/api/) + [docs/api-design.md](docs/api-design.md) + [docs/database-migrations.md](docs/database-migrations.md)                                   |
| 部署 / 网关      | [docs/deploy.md](docs/deploy.md) + [docs/release-runbook.md](docs/release-runbook.md)                                                                            |
| CLI / Agent 协议 | [docs/cli-design.md](docs/cli-design.md) + [docs/agent-usage.md](docs/agent-usage.md)                                                                            |
| 技术决策         | [docs/tech-decisions.md](docs/tech-decisions.md)                                                                                                                 |

## 部署架构

```text
[微信小程序]            [iOS / Android / 鸿蒙]
      │                          │
      └────────────┬─────────────┘
                   ▼
       https://xingxiaolin.cn  ←  xiaolin-gateway（VPS 入口）
                   │
                   ▼
            VPS :8082
                   │
                   ▼
       ai-todo-api (FastAPI, Docker)
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
   PostgreSQL             Redis (optional)
```

**关键约束**：

- 生产域名 `xingxiaolin.cn` 走 xiaolin-gateway（不在本仓库），不在小程序源码里硬编码路径
- 真实小程序 AppID 不入库（见 [apps/miniapp/CLAUDE.md](apps/miniapp/CLAUDE.md)）
- 上传密钥（`private.wx*.key`）不入库，已在 `.gitignore`

## CI/CD

4 阶段流水线（[.github/workflows/ci.yml](.github/workflows/ci.yml)）：

```
scan (typecheck + lint) → build (artifacts + image) → test (pytest) → publish-manifest
```

CD（[.github/workflows/cd.yml](.github/workflows/cd.yml)）：5 阶段

```
resolve-manifest → classify-release → deploy → post-deploy-verify → [rollback / accepted]
```

CD 含 **自动回滚**：post-deploy-verify 失败 → rollback job 自动跑 → 重新验证。详见 [docs/release-runbook.md](docs/release-runbook.md)。

## 不要做的事

- ❌ 提交 `private.wx*.key` / `ci.env` / `project.private.config.json` / `apps/api/.env` 到 Git
- ❌ 在小程序源码里硬编码真实 AppID
- ❌ 跳过 lint/typecheck/test 中任何一项（CD 验收有 4 阶段，缺一不可）
- ❌ 在 `apps/api` 里改 alembic 迁移而不写对应 schema 校验脚本（见 [docs/database-migrations.md](docs/database-migrations.md)）
- ❌ 把整个 `dev-standards` 标准库复制到本仓库（按需引用）
- ❌ 用 `--no-verify` 绕过 pre-commit hook（紧急情况可，但要在 commit message 注明）

## 本地 Git hooks（Husky）

`.husky/` 目录是本仓库 git hook 源真，**所有钩子脚本必须入库**（不只是本地）：

| Hook         | 触发         | 工具                   | 行为                                                |
| ------------ | ------------ | ---------------------- | --------------------------------------------------- |
| `pre-commit` | `git commit` | gitleaks + lint-staged | gitleaks 扫暂存区 → eslint --fix → prettier --write |
| `commit-msg` | `git commit` | commitlint             | 强制 conventional commits 格式                      |

启用方式（**首次拉代码后必跑**）：

```bash
pnpm install --frozen-lockfile   # 自动触发 husky prepare
```

**`gitleaks` 本地未装时的降级**：

- pre-commit 会打印警告，但**不阻断** commit
- CI 的 `0-scan · Secret scan (gitleaks)` job 兜底
- 推荐安装（macOS）：`brew install gitleaks`

**commit message 格式**（[commitlint.config.cjs](commitlint.config.cjs)）：

```text
<type>(<scope>): <subject>      # 必填，< 100 字符
<BLANK LINE>
<body>                          # 可选
<BLANK LINE>
<footer>                        # 可选（如 BREAKING CHANGE: ...）
```

`type` 限定为：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`。
