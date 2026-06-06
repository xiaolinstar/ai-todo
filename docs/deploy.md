# ai-todo 生产部署

本文说明如何在腾讯云 VPS 上用 Docker 部署 ai-todo API，并通过 **xiaolin-gateway** 提供 HTTPS，完成小程序上线所需配置。

## 架构（推荐）

与 [xiaolin-docs](https://github.com/xiaolinstar/xiaolin-docs) / [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 一致：

```text
小程序 wx.request
    → https://xingxiaolin.cn/v1/...
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
- 已备案域名 **xingxiaolin.cn**（ai待办服务主体；HTTPS 证书放在 xiaolin-gateway）
- 微信小程序 AppID / AppSecret（测试号或正式号）
- xiaolin-gateway 已部署并可 `git pull && docker compose up -d`

### 生产域名

| 域名 | 说明 |
|------|------|
| **`https://xingxiaolin.cn`** | 唯一正式 API 域名（小程序代码、CLI 文档、CD 拨测均以此为准） |
| `wodi.games` | **过渡保留**：网关仍可反代，供尚未重新上传的旧版小程序体验版；新发布不再使用 |

CLI 用户请将 `~/.ai-todo/settings.json` 中 `url` 改为 `https://xingxiaolin.cn`。微信公众平台 **request 合法域名** 需包含 `xingxiaolin.cn`。

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

1. 证书放到 `app/ai-todo/cert/`（`xingxiaolin.cn_bundle.crt`、`xingxiaolin.cn.key`）
2. vhost 配置 `app/ai-todo/ai-todo.conf`：`xingxiaolin.cn` → `宿主机IP:8082`
3. `docker-compose.yml` 挂载 `app/ai-todo/cert`

部署 gateway（重启容器会重新加载配置，**无需**额外 `docker exec nginx -s reload`）：

```bash
cd ~/AgentProjects/xiaolin-gateway
git pull
docker compose up -d
curl https://xingxiaolin.cn/v1/health
```

## 3. 微信小程序

### 合法域名（微信公众平台，非代码）

登录 [微信公众平台](https://mp.weixin.qq.com/)（或[测试号管理页](https://mp.weixin.qq.com/debug/cgi-bin/sandbox)）→ **开发 → 开发管理 → 开发设置 → 服务器域名**：

| 类型 | 填写内容 |
|------|----------|
| request 合法域名 | `https://xingxiaolin.cn`（测试号）；正式号多为 `xingxiaolin.cn` |

注意：

- **仅在公众平台后台填写**，不在小程序代码里配置
- 不要带路径或端口
- 测试号与正式号输入格式可能不同，以当前后台提示为准
- 配置后约 5 分钟生效

### 小程序代码侧

| 项 | 配置位置 |
|----|----------|
| AppID | `apps/miniapp/project.config.json` → `appid` |
| API 基址 | 代码默认 `https://xingxiaolin.cn`（体验版/正式版）；开发者工具用 `http://127.0.0.1:3100` |
| 微信登录 | 「我的」页 → 微信登录 |

本地开发：开发者工具勾选「不校验合法域名」，API 使用 `http://127.0.0.1:3100`。

## 数据库密码

### 为什么改 `.env.production` 不够？

Postgres 官方镜像 **只在数据卷首次创建时** 读取 `POSTGRES_PASSWORD` 并初始化库。之后修改 `.env.production` 只会改变 API 容器使用的密码，**不会**自动更新卷里已存储的密码——这是 PostgreSQL Docker 的标准行为，不是 ai-todo 的 bug。

| 场景 | 做法 |
|------|------|
| **首次部署** | 在 `.env.production` 设好密码 → `docker compose up` 即可 |
| **轮换密码（保留数据）** | 见下方脚本 |
| **开发/测试清空重来** | `docker compose down -v` 后重新 `up`（**删除全部业务数据**） |

### 轮换密码（推荐流程）

```bash
cd ~/AgentProjects/ai-todo/apps/api

# 1. 编辑 .env.production，把 POSTGRES_PASSWORD 改为新密码
# 2. 同步到 Postgres 卷内并重启 API
python3 scripts/rotate_postgres_password.py

# 3. 验证
curl http://127.0.0.1:8082/v1/health
```

预览 SQL（不执行）：

```bash
python3 scripts/rotate_postgres_password.py --dry-run
```

**注意：**

- 密码可含 `@`、`#` 等字符；entrypoint 会自动 URL 编码，**不要**手写 `AI_TODO_DATABASE_URL`（除非你知道如何编码）
- 若曾手动设置过 `AI_TODO_DATABASE_URL`，轮换后请删除该行，避免与 `POSTGRES_PASSWORD` 不一致
- 先备份再轮换：`docker compose -f docker-compose.prod.yml exec postgres pg_dump -U ai_todo ai_todo > backup.sql`

### 故障现象

API 日志出现 `password authentication failed for user "ai_todo"` → 几乎总是 **env 密码与卷内密码不一致**，按上表处理，**不要**反复 `down -v` 除非确认可以丢数据。

## 容器行为

| 步骤 | 说明 |
|------|------|
| 等待数据库 | `scripts/wait_for_db.py` 轮询 PostgreSQL |
| 迁移 | `alembic upgrade head` |
| 启动 | `python -m ai_todo_api`，容器内监听 `0.0.0.0:3100` |

## 配置如何进入 API 容器

**Secrets 与业务配置不会写入 Dockerfile 镜像层**，而是在 `docker compose up` 时注入。

```text
apps/api/.env.production（VPS 上，gitignore）
    ↓ docker compose --env-file .env.production
docker-compose.prod.yml 的 environment: 段
    ↓ 容器启动时
docker-entrypoint.sh（拼装 AI_TODO_DATABASE_URL、alembic）
    ↓
ai_todo_api（pydantic Settings，读取 AI_TODO_* 环境变量）
```

| 来源 | 作用范围 | 示例 |
|------|----------|------|
| **Dockerfile** | 构建默认值 | `AI_TODO_PORT=3100`、`PIP_INDEX_URL`（构建参数） |
| **`.env.production`** | API / Postgres 运行时 | `POSTGRES_PASSWORD`、`AI_TODO_WECHAT_APP_SECRET` |
| **CD SSH 注入** | 仅部署脚本 | `AI_TODO_PULL_REGISTRY_MIRROR`、`AI_TODO_DEPLOY_MODE`（不进 API 容器） |
| **deploy-manifest** | 指定本次镜像 digest | `AI_TODO_API_IMAGE=ghcr.io/...` 或 NJU 同名 digest |

应用代码见 `apps/api/src/ai_todo_api/config.py`（`env_prefix=AI_TODO_`）。

## 环境变量

| 变量 | 生产推荐 | 说明 |
|------|----------|------|
| `POSTGRES_PASSWORD` | **必填** | 数据库密码 |
| `AI_TODO_ALLOW_DEV_AUTH` | `false` | 关闭 dev 旁路 |
| `AI_TODO_WECHAT_APP_ID` | **必填** | 微信小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | **必填** | 微信小程序 AppSecret |
| `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID` | 推荐填写 | 微信订阅消息模板 ID；为空时小程序不展示微信提醒开关 |
| `AI_TODO_PUBLISH_PORT` | `8082` | 宿主机映射端口 |
| `AI_TODO_PORT` | `3100` | 容器内端口 |
| `PIP_INDEX_URL` | 腾讯云镜像 | server-build 时 pip 源 |
| `APT_MIRROR` | `mirrors.tencent.com` | server-build 时 Debian apt 源 |
| `AI_TODO_IMAGE_RETENTION` | `3` | 部署后保留的 API 镜像 digest 数量 |

完整模板见 `apps/api/.env.production.example`。

## 提醒触达 Worker

提醒触达服务端闭环已就绪：小程序创建/改期提醒时可 `requestSubscribeMessage`，API 写入 delivery 队列，worker 扫描到期记录并调用微信 send API。

生产 compose 中 `worker` 使用 `notifications` profile。**CD 部署脚本**（`deploy-from-manifest.sh`）在检测到 `.env.production` 已配置非空 `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID` 时，会自动带上 `--profile notifications` 启动 worker；未配置模板 ID 时仍只启动 `api` + `postgres`。

手动启停示例：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production --profile notifications up -d
```

`api` 与 `worker` 复用同一个镜像：

- `api`：处理 HTTP API、小程序登录、提醒/日程/联系人 CRUD
- `worker`：运行 `python -m ai_todo_api.modules.notifications.worker`，定时扫描到期的微信订阅消息投递记录

启用前，需要在微信公众平台申请提醒事项订阅消息模板，并在 `.env.production` 配置：

```bash
AI_TODO_WECHAT_REMINDER_TEMPLATE_ID=你的模板ID
```

该模板当前按公共模板 **#15788（待办事项到期提醒）** 字段发送：

| 模板展示名 | keyword | 内容 |
|-----------|---------|------|
| 事项主题 | `thing23` | 提醒标题 |
| 截止日期 | `time2` | 截止/提醒时刻（`YYYY年M月D日 HH:MM`） |
| 备注 | `thing13` | 备注，无则「点击查看提醒详情」 |

若更换模板，keyword 以公众平台「我的模板 → 详情」为准，并同步修改 `worker.py` 中的字段常量。

联调验收：

1. 小程序创建带截止时间的提醒并接受订阅；
2. `GET /v1/notifications/status` 对应记录为 `pending`；
3. 到期后 worker 发送，状态变为 `sent`（或 `no_quota` / `failed` 等可诊断状态）；
4. 点击订阅消息应打开提醒编辑页（`reminders?reminderId=` 深链）。

## CI / CD

详见 **[docs/ci-cd.md](./ci-cd.md)**（`deploy_mode`、NJU 镜像、pull/server-build）。

**踩坑复盘（国内 VPS + GHCR，可复用到其它项目）**：[deploy-troubleshooting.md](./deploy-troubleshooting.md)。

| 工作流 | 文件 | 触发 |
|--------|------|------|
| CI | `.github/workflows/ci.yml` | push / PR → `main` |
| CD | `.github/workflows/cd.yml` | `main` CI 成功 + `deploy-manifest`；或手动 |

**VPS 部署脚本**（CD 在 `git pull` 后调用）：

| 脚本 | 作用 |
|------|------|
| `apps/api/deploy/cd-bootstrap.sh` | 设置 pull/镜像站/健康检查超时，调用 `remote-deploy.sh` |
| `apps/api/deploy/remote-deploy.sh` | 有 manifest → `deploy-from-manifest.sh`；否则本地 `compose build` |
| `apps/api/deploy/deploy-from-manifest.sh` | 校验指纹 → pull 或 server-build → 健康检查 → 写 `.deploy/` |
| `apps/api/deploy/prune-container-images.sh` | 按 `image-retention.json` 清理旧 API 镜像 |

**部署产物（服务器仓库内，不提交 git）**：

| 文件 | 内容 |
|------|------|
| `.deploy/current.json` | 当前 `gitSha`、镜像、`deployMode`、`fingerprint` |
| `.deploy/image-retention.json` | 最近 N 个 digest（默认 3，供回滚与 prune） |

部署成功后，`/v1/health` 会返回 `apiVersion`（组件 L1，来自 `pyproject.toml`）、`releaseTag` 与 `gitSha`（Git/CD 构建身份）。CD 仍根据 `release_tag` 注入后两者；组件版本规则见 `docs/releases/versioning.md`。

**CD Secrets（production Environment）：**

| Secret | 说明 |
|--------|------|
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` 或 `DEPLOY_PASSWORD` / `DEPLOY_PATH` | SSH |
| `GHCR_DEPLOY_TOKEN` | 可选；GHCR 包为 **public** 时通常可不配 |

**VPS 要求**：`python3`（部署脚本用，3.10+ 即可）、`docker compose` v2。部署脚本内嵌 Python 使用 `timezone.utc`，兼容 3.10。

**完整上线 checklist**：见 [docs/release-runbook.md](./release-runbook.md)。

## TLS 与证书

当前生产环境推荐：

```text
腾讯云免费证书（手动续约）
  → xiaolin-gateway / Nginx 统一终止 HTTPS
  → 反代到 ai-todo 宿主机 :8082
```

ai-todo API 容器本身只暴露 HTTP，由 gateway 负责 HTTPS、证书挂载和续约后的重载。证书到期前需要在腾讯云重新申请/下载免费证书，替换 xiaolin-gateway 中对应证书文件，然后重启 gateway：

```bash
cd ~/AgentProjects/xiaolin-gateway
docker compose up -d
```

### 备选：内置 Caddy（当前不用）

`docker-compose.tls.yml` 是可选 Caddy overlay，仅适用于不使用 xiaolin-gateway、希望由 ai-todo 仓库自己终止 HTTPS 的部署方式。

当前项目使用 xiaolin-gateway + 腾讯云证书路线，因此默认不需要启用：

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml ...
```

除非未来迁移为 ai-todo 独立管理 HTTPS，否则可以忽略 `docker-compose.tls.yml`。

## 本地开发 vs 生产

| 项 | 本地 | 生产 |
|----|------|------|
| Compose | `docker-compose.yml`（Postgres + API，可选 worker） | `docker-compose.prod.yml` |
| API 运行 | Docker 容器 → 宿主机 :3100；或可选宿主机 `pnpm dev:api` | Docker 容器 → 宿主机 :8082 |
| HTTPS | 不需要 | xiaolin-gateway → `https://xingxiaolin.cn` |
| 合法域名 | 开发者工具跳过校验 | 公众平台配置 `xingxiaolin.cn` |
| 小程序 API | `http://127.0.0.1:3100` | `https://xingxiaolin.cn`（代码默认） |

## 相关文档

- 上线操作手册：`docs/release-runbook.md`
- 技术决策：`docs/tech-decisions.md`
- 小程序开发：`apps/miniapp/README.md`
- 网关项目：`https://github.com/xiaolinstar/xiaolin-gateway`
