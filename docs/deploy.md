# ai-todo 生产部署

本文说明如何在自有服务器上用 Docker 部署 ai-todo API，并完成小程序上线所需的 HTTPS 与域名配置（Phase C1–C3）。

## 前置条件

- Linux 服务器（或任意支持 Docker 的环境）
- [Docker Engine](https://docs.docker.com/engine/install/) 与 Docker Compose v2
- 已备案域名（小程序 request 合法域名要求 HTTPS）
- 微信小程序 AppID / AppSecret

## 快速部署（Docker Compose）

在服务器上克隆仓库后：

```bash
cd apps/api
cp .env.production.example .env.production
```

编辑 `.env.production`，**至少修改**：

| 变量 | 说明 |
|------|------|
| `POSTGRES_PASSWORD` | 数据库强密码 |
| `AI_TODO_WECHAT_APP_ID` | 小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | 小程序 AppSecret |

启动 API + PostgreSQL（API 仅绑定本机 `127.0.0.1:3100`，供反向代理转发）：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

验证：

```bash
curl http://127.0.0.1:3100/v1/health
# {"ok":true,"data":{"service":"ai-todo-api","status":"ok"}}
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

## HTTPS（Caddy）

小程序正式环境 **必须** 使用 HTTPS。推荐在 API 前加 Caddy 自动签发证书。

### 方式 A：Docker Compose TLS 叠加

```bash
cd apps/api
cp deploy/Caddyfile.example deploy/Caddyfile
# 编辑 deploy/Caddyfile，确认 reverse_proxy 指向 api:3100
```

在 `.env.production` 增加：

```bash
API_DOMAIN=api.example.com
API_UPSTREAM=api:3100
```

启动带 TLS 的完整栈：

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml \
  --env-file .env.production up -d --build
```

验证：

```bash
curl https://api.example.com/v1/health
```

### 方式 B：宿主机 Caddy / Nginx

API 容器已绑定 `127.0.0.1:3100`，在宿主机安装 Caddy 或 Nginx 即可。

宿主机 Caddy 示例（`/etc/caddy/Caddyfile`）：

```caddy
api.example.com {
  reverse_proxy 127.0.0.1:3100
}
```

Nginx 同理：`proxy_pass http://127.0.0.1:3100;`，并配置 TLS（certbot 等）。

模板见 `apps/api/deploy/Caddyfile.example`。

## 微信小程序合法域名（C3）

在 [微信公众平台](https://mp.weixin.qq.com/) → **开发** → **开发管理** → **开发设置** → **服务器域名**：

| 类型 | 域名 | 示例 |
|------|------|------|
| request 合法域名 | API 域名（HTTPS，无端口路径） | `https://api.example.com` |

注意：

- 仅填域名，不要带 `https://` 前缀或路径
- 域名需已备案且证书有效
- 配置后约 5 分钟生效

### 小程序端配置

1. 打开 `apps/miniapp`，在 **我的** 页将 API 地址改为 `https://api.example.com`
2. 使用 **微信登录**（`wx.login` → `POST /v1/auth/wechat/login`）
3. 关闭开发者工具 **「不校验合法域名、web-view、TLS 版本」** 选项后再测
4. 真机预览 / 体验版验证 request 与登录流程

本地开发仍可继续使用 `http://127.0.0.1:3100` + 勾选「不校验合法域名」。

## 容器行为

| 步骤 | 说明 |
|------|------|
| 等待数据库 | `scripts/wait_for_db.py` 轮询 PostgreSQL |
| 迁移 | `alembic upgrade head` |
| 启动 | `python -m ai_todo_api`，监听 `0.0.0.0:3100` |

镜像内置 healthcheck：`GET /v1/health`。

## 环境变量

| 变量 | 生产推荐 | 说明 |
|------|----------|------|
| `POSTGRES_PASSWORD` | **必填** | 数据库密码 |
| `AI_TODO_ALLOW_DEV_AUTH` | `false` | 关闭无 Token 的 `user_dev` 旁路 |
| `AI_TODO_WECHAT_APP_ID` | **必填** | 微信小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | **必填** | 微信小程序 AppSecret |
| `AI_TODO_RATE_LIMIT_ENABLED` | `true` | 启用限流 |
| `AI_TODO_RATE_LIMIT_WECHAT_LOGIN_PER_MINUTE` | `10` | 每 IP 每分钟微信登录次数上限 |
| `AI_TODO_HOST` | `0.0.0.0` | compose 已设置 |
| `AI_TODO_PORT` | `3100` | 容器内端口 |
| `AI_TODO_PUBLISH_PORT` | `3100` | 宿主机映射端口（绑定 127.0.0.1） |
| `AI_TODO_TIMEZONE` | `Asia/Shanghai` | 默认用户时区 |
| `API_DOMAIN` | TLS 叠加必填 | Caddy 证书域名 |
| `API_UPSTREAM` | `api:3100` | Caddy 反代目标 |

完整模板见 `apps/api/.env.production.example`。

### 生产认证说明

`AI_TODO_ALLOW_DEV_AUTH=false` 时，**所有 API 请求必须带** `Authorization: Bearer aitodo_…`。

- CLI / Agent：使用 PAT（`AI_TODO_TOKEN` 或 `ai-todo login --token`）
- 小程序：微信登录自动签发 PAT（`POST /v1/auth/wechat/login`）

### 限流说明

`/v1/auth/wechat/login` 默认按客户端 IP 限流（识别 `X-Forwarded-For`，需在反向代理后保留该头）。超限返回 `429`，错误码 `RATE_LIMITED`。

## CI / CD

| 工作流 | 文件 | 触发 |
|--------|------|------|
| CI | `.github/workflows/ci.yml` | push / PR → `main` |
| Deploy | `.github/workflows/deploy.yml` | CI 成功后自动部署；可手动 `workflow_dispatch` |

**完整上线操作手册（含 GitHub Secrets、小程序提审、回滚）**：见 **[docs/release-runbook.md](./release-runbook.md)**。

## 仅构建 API 镜像

```bash
cd apps/api
docker build -t ai-todo-api:latest .
docker run --rm -p 3100:3100 \
  -e AI_TODO_DATABASE_URL='postgresql+psycopg://user:pass@host:5432/ai_todo' \
  -e AI_TODO_ALLOW_DEV_AUTH=false \
  ai-todo-api:latest
```

需确保数据库可从容器访问，且已创建空库。

## 升级发布

手动升级（未启用 GitHub Actions 时）：

```bash
git pull
bash apps/api/deploy/remote-deploy.sh
```

启用 Actions 后，merge `main` 即可自动部署。启动时会自动执行新的 Alembic 迁移。

## 本地开发 vs 生产

| 项 | 本地 | 生产 |
|----|------|------|
| Compose 文件 | `docker-compose.yml`（仅 Postgres） | `docker-compose.prod.yml`（Postgres + API） |
| TLS | 不需要 | Caddy / Nginx + 合法域名 |
| Env 文件 | `.env` / `.env.example` | `.env.production` |
| Dev 旁路 | `AI_TODO_ALLOW_DEV_AUTH=true` | **必须** `false` |
| API 运行 | 宿主机 `python -m ai_todo_api` | Docker 容器 |
| 小程序 API 地址 | `http://127.0.0.1:3100` | `https://api.example.com` |

## 相关文档

- 上线操作手册：`docs/release-runbook.md`
- 技术决策：`docs/tech-decisions.md`
- 小程序开发：`apps/miniapp/README.md`
