# AI Todo 待办事项管理系统

AI 原生的待办事项、日历和联系人后端服务，提供结构化 CLI 接口供智能代理（OpenClaw、Claude 等）使用 — 服务器端不内置自然语言解析。

## 项目结构

```text
apps/
  api/          # FastAPI 后端服务
  cli/          # 命令行工具
  miniapp/      # 微信小程序
  ios/          # iOS 应用
  android/      # Android 应用
  harmony/      # 鸿蒙应用
packages/
  shared/       # 共享代码
  api-client/   # API 客户端
  agent-protocol/ # 代理协议
  config/       # 配置管理
docs/
  tech-decisions.md      # 技术决策文档
  miniapp-conventions.md # 微信小程序开发规范
```

## 快速开始

```bash
pnpm install --frozen-lockfile  # 安装依赖并初始化 Husky hooks
pnpm typecheck                  # 类型检查
pnpm lint                       # 静态检查
pnpm build                      # 构建项目
```

本地 Git hooks（pre-commit：gitleaks + lint-staged；commit-msg：commitlint）详见
[docs/developer-guide.md §本地 Git hooks](docs/developer-guide.md#本地-git-hooks首次拉代码)。

Cursor 规则来自 [`dev-standards`](~/AgentProjects/dev-standards) adapter，部署命令：

```bash
~/AgentProjects/dev-standards/scripts/sync.sh adapters cursor .
```

## 智能代理集成

使用带 `--json` 参数的结构化 CLI — 服务器端不内置自然语言处理。

```bash
pnpm dev:api          # 终端 1：启动 API 服务
pnpm cli today --json # 终端 2：调用 CLI 获取今日待办
```

- 命令参考：[docs/agent-usage.md](docs/agent-usage.md)
- 可安装技能：[skills/ai-todo/SKILL.md](skills/ai-todo/SKILL.md)
- 开发者指南：[docs/developer-guide.md](docs/developer-guide.md)

## API 开发

后端使用 Python + FastAPI 技术栈。

```bash
# 创建虚拟环境
python3 -m venv apps/api/.venv

# 安装开发依赖
apps/api/.venv/bin/python -m pip install -e "apps/api[dev]"

# 启动数据库并运行迁移
(cd apps/api && docker compose up -d postgres && .venv/bin/alembic upgrade head)

# 启动开发服务器
pnpm dev:api
```

API 默认监听在 `http://127.0.0.1:3100`。

## 生产部署

生产环境通过 **xiaolin-gateway** 提供 `https://xingxiaolin.cn` 访问，API 宿主机端口为 **8082**。

详见 [docs/deploy.md](docs/deploy.md) 了解 Docker 部署、网关路由、微信域名配置和 CI/CD 流程。**发布手册**：[docs/release-runbook.md](docs/release-runbook.md)。**部署踩坑复盘**（国内 VPS + GHCR）：[docs/deploy-troubleshooting.md](docs/deploy-troubleshooting.md)。

## 小程序开发

微信小程序 MVP 位于 `apps/miniapp/` 目录。详见 [apps/miniapp/README.md](apps/miniapp/README.md)。

```bash
pnpm dev:api      # 首先启动 API 服务
pnpm check:wechat # 如果修改了小程序的 .ts/.scss 文件
# 然后在微信开发者工具中打开 apps/miniapp（本地开发时禁用域名校验）
```

## 测试运行

运行所有测试并生成覆盖率报告：

```bash
pnpm test:api
```

测试覆盖率达到 87%+，测试文件按业务模块组织在 `apps/api/tests/` 目录下。

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源。  
**无需**事先申请专利或软件著作权登记即可使用本协议；代码完成时即享有著作权，Apache 2.0 中的专利条款表示：若你将来拥有相关专利，使用者仍可在协议范围内免费使用，而非要求你事先持有专利。

---

_[English Version](README.en.md)_
