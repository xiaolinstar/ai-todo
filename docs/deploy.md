# ai-todo 生产部署（Phase C1）

本文说明如何在自有服务器上用 Docker 部署 ai-todo API。**Phase C1 仅包含 API + PostgreSQL**；微信小程序微信登录（Phase C2）完成后，小程序才能在不开启 dev 旁路的情况下使用。

## 前置条件

- Linux 服务器（或任意支持 Docker 的环境）
- [Docker Engine](https://docs.docker.com/engine/install/) 与 Docker Compose v2
- 域名 + HTTPS（小程序正式环境必需；API 可先 HTTP 内网验证）

## 快速部署（Docker Compose）

在服务器上克隆仓库后：

```bash
cd apps/api
cp .env.production.example .env.production
```

编辑 `.env.production`，**至少修改** `POSTGRES_PASSWORD` 为强密码。

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
| `AI_TODO_HOST` | `0.0.0.0` | compose 已设置 |
| `AI_TODO_PORT` | `3100` | 容器内端口 |
| `AI_TODO_PUBLISH_PORT` | `3100` | 宿主机映射端口 |
| `AI_TODO_TIMEZONE` | `Asia/Shanghai` | 默认用户时区 |

完整模板见 `apps/api/.env.production.example`。

### 生产认证说明

`AI_TODO_ALLOW_DEV_AUTH=false` 时，**所有 API 请求必须带** `Authorization: Bearer aitodo_…`。

- CLI / Agent：使用 PAT（`AI_TODO_TOKEN` 或 `ai-todo login --token`）
- 小程序：Phase C2 将通过微信登录自动签发 PAT；C1 阶段可临时手动在「我的」页配置 PAT（需先用 dev 环境或已有 token 创建）

## HTTPS 反向代理（Caddy 示例）

小程序 request 合法域名要求 HTTPS。在 API 前加反向代理：

```text
api.example.com  →  127.0.0.1:3100
```

`/etc/caddy/Caddyfile` 示例：

```caddy
api.example.com {
  reverse_proxy 127.0.0.1:3100
}
```

Nginx 同理：`proxy_pass http://127.0.0.1:3100;`，并配置 TLS 证书（如 certbot）。

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

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

启动时会自动执行新的 Alembic 迁移。

## 本地开发 vs 生产

| 项 | 本地 | 生产 |
|----|------|------|
| Compose 文件 | `docker-compose.yml`（仅 Postgres） | `docker-compose.prod.yml`（Postgres + API） |
| Env 文件 | `.env` / `.env.example` | `.env.production` |
| Dev 旁路 | `AI_TODO_ALLOW_DEV_AUTH=true` | **必须** `false` |
| API 运行 | 宿主机 `python -m ai_todo_api` | Docker 容器 |

## 下一步（Phase C2）

- `POST /v1/auth/wechat/login` + 小程序 `wx.login`
- 微信公众平台配置 request 合法域名
- 关闭小程序「不校验合法域名」调试选项

见 `docs/tech-decisions.md` 认证策略章节。
