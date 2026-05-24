# ai-todo 生产部署

本文说明如何在腾讯云 VPS 上用 Docker 部署 ai-todo API，并通过 **xiaolin-gateway** 提供 HTTPS，完成小程序上线所需配置。

## 架构（推荐）

与 [xiaolin-docs](https://github.com/xiaolinstar/xiaolin-docs) / [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 一致：

```text
小程序 wx.request
    → https://wodi.games/v1/...
    → xiaolin-gateway（Nginx，443，证书集中管理）
    → 宿主机 :8082
    → ai-todo API 容器（内部 :3100）+ Postgres
```

宿主机端口约定（与现有服务对齐）：

| 服务 | 宿主机端口 |
|------|-----------|
| xiaolin-docs | 8080 |
| xiaolin-life | 8081 |
| **ai-todo API** | **8082** |

## 前置条件

- Linux 服务器 + Docker Compose v2
- 已备案域名 **wodi.games**（HTTPS 证书放在 xiaolin-gateway）
- 微信小程序 AppID / AppSecret（测试号或正式号）
- xiaolin-gateway 已部署并可 `git pull && docker compose up -d`

## 1. 部署 API（ai-todo 仓库）

```bash
cd ~/AgentProjects/ai-todo/apps/api
cp .env.production.example .env.production
# 编辑 POSTGRES_PASSWORD、AI_TODO_WECHAT_APP_ID/SECRET
```

`.env.production` 关键项：

| 变量 | 说明 |
|------|------|
| `POSTGRES_PASSWORD` | 数据库强密码 |
| `AI_TODO_PUBLISH_PORT` | `8082`（默认） |
| `AI_TODO_ALLOW_DEV_AUTH` | `false` |
| `AI_TODO_WECHAT_APP_ID` | 小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | 小程序 AppSecret |

启动（**不要**启用 `docker-compose.tls.yml`，TLS 由 gateway 负责）：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl http://127.0.0.1:8082/v1/health
```

### Docker 构建失败（pip install exit code 1）

国内服务器访问 PyPI 可能超时。compose 已默认使用腾讯云镜像；也可显式指定：

```bash
PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple \
  docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
```

或单独构建镜像：

```bash
docker build \
  --build-arg PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple \
  -t ai-todo-api:latest .
```

查看构建详细日志：

```bash
docker compose -f docker-compose.prod.yml build --progress=plain --no-cache api 2>&1 | tee /tmp/ai-todo-build.log
```

## 2. 配置 xiaolin-gateway

在 [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 仓库：

1. 证书放到 `app/ai-todo/cert/`（`wodi.games_bundle.crt`、`wodi.games.key`）
2. vhost 配置 `app/ai-todo/ai-todo.conf`：`wodi.games` → `宿主机IP:8082`
3. `docker-compose.yml` 挂载 `app/ai-todo/cert`

部署 gateway（重启容器会重新加载配置，**无需**额外 `docker exec nginx -s reload`）：

```bash
cd ~/AgentProjects/xiaolin-gateway
git pull
docker compose up -d
curl https://wodi.games/v1/health
```

## 3. 微信小程序

### 合法域名（微信公众平台，非代码）

登录 [微信公众平台](https://mp.weixin.qq.com/)（或[测试号管理页](https://mp.weixin.qq.com/debug/cgi-bin/sandbox)）→ **开发 → 开发管理 → 开发设置 → 服务器域名**：

| 类型 | 填写内容 |
|------|----------|
| request 合法域名 | `https://wodi.games`（测试号）；正式号多为 `wodi.games` |

注意：

- **仅在公众平台后台填写**，不在小程序代码里配置
- 不要带路径或端口
- 测试号与正式号输入格式可能不同，以当前后台提示为准
- 配置后约 5 分钟生效

### 小程序代码侧

| 项 | 配置位置 |
|----|----------|
| AppID | `apps/miniapp/project.config.json` → `appid` |
| API 基址 | 代码默认 `https://wodi.games`（体验版/正式版）；开发者工具用 `http://127.0.0.1:3100` |
| 微信登录 | 「我的」页 → 微信登录 |

本地开发：开发者工具勾选「不校验合法域名」，API 使用 `http://127.0.0.1:3100`。

## 容器行为

| 步骤 | 说明 |
|------|------|
| 等待数据库 | `scripts/wait_for_db.py` 轮询 PostgreSQL |
| 迁移 | `alembic upgrade head` |
| 启动 | `python -m ai_todo_api`，容器内监听 `0.0.0.0:3100` |

## 环境变量

| 变量 | 生产推荐 | 说明 |
|------|----------|------|
| `POSTGRES_PASSWORD` | **必填** | 数据库密码 |
| `AI_TODO_ALLOW_DEV_AUTH` | `false` | 关闭 dev 旁路 |
| `AI_TODO_WECHAT_APP_ID` | **必填** | 微信小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | **必填** | 微信小程序 AppSecret |
| `AI_TODO_PUBLISH_PORT` | `8082` | 宿主机映射端口 |
| `AI_TODO_PORT` | `3100` | 容器内端口 |
| `PIP_INDEX_URL` | 腾讯云镜像 | Docker 构建时 pip 源 |

完整模板见 `apps/api/.env.production.example`。

## CI / CD

| 工作流 | 文件 | 触发 |
|--------|------|------|
| CI | `.github/workflows/ci.yml` | push / PR → `main` |
| Deploy | `.github/workflows/deploy.yml` | CI 成功后自动部署；可手动触发 |

**完整上线 checklist**：见 [docs/release-runbook.md](./release-runbook.md)。

## 备选：内置 Caddy（无 xiaolin-gateway 时）

若未使用 gateway，可启用 `docker-compose.tls.yml` + `deploy/Caddyfile`。当前生产环境推荐 gateway 方案，见上文。

## 本地开发 vs 生产

| 项 | 本地 | 生产 |
|----|------|------|
| Compose | `docker-compose.yml`（仅 Postgres） | `docker-compose.prod.yml` |
| API 运行 | 宿主机 `pnpm dev:api`（:3100） | Docker 容器 → 宿主机 :8082 |
| HTTPS | 不需要 | xiaolin-gateway → `https://wodi.games` |
| 合法域名 | 开发者工具跳过校验 | 公众平台配置 `wodi.games` |
| 小程序 API | `http://127.0.0.1:3100` | `https://wodi.games`（代码默认） |

## 相关文档

- 上线操作手册：`docs/release-runbook.md`
- 技术决策：`docs/tech-decisions.md`
- 小程序开发：`apps/miniapp/README.md`
- 网关项目：`https://github.com/xiaolinstar/xiaolin-gateway`
