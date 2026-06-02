# ai-todo 发布上线操作手册

本文是 **从 0 到上线** 的 checklist，包含 API 部署（GitHub Actions）与微信小程序发布。

相关文档：

- 部署细节：[deploy.md](./deploy.md)
- 部署踩坑复盘：[deploy-troubleshooting.md](./deploy-troubleshooting.md)
- 开发者手册：[developer-guide.md](./developer-guide.md)
- 版本计划：[releases/versioning.md](./releases/versioning.md)
- `0.1.0` 内测上线规划：[releases/v0.1.0-plan.md](./releases/v0.1.0-plan.md)
- 小程序开发：[../apps/miniapp/README.md](../apps/miniapp/README.md)
- 网关配置：[xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway)

---

## 一、架构概览

```text
开发者 push main
    → CI（scan → build → test → publish deploy-manifest）
    → 小程序体验版人工上传/验收
    → 手动触发 CD，填写发布 tag，自动解析 tag 指向 commit 的成功 CI
    → CD 校验指纹后部署（默认 VPS docker pull；pull 失败则 server-build 兜底）
    → git pull + docker compose up --build（API 宿主机 :8082）
    → xiaolin-gateway 反代 https://wodi.games
    → curl https://wodi.games/v1/health

微信用户打开小程序
    → wx.request https://wodi.games/v1/...
    → wx.login → POST /v1/auth/wechat/login
    → 获得 PAT → 调用 /v1/reminders 等 API
```

**API 与小程序是两条发布线：**

| 组件 | 发布方式 | 频率 |
|------|----------|------|
| API + Postgres | 手动 GitHub Actions CD → VPS Docker | 版本确认发布时 |
| xiaolin-gateway | xiaolin-gateway 仓库 CD | 域名/证书/路由变更时 |
| 微信小程序 | 微信开发者工具上传 → 公众平台提审 | 功能变更时 |

---

## 二、一次性准备（VPS）

### 1. 安装依赖

```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

### 2. 克隆仓库

```bash
mkdir -p ~/AgentProjects/ai-todo
git clone https://github.com/xiaolinstar/ai-todo.git ~/AgentProjects/ai-todo
cd ~/AgentProjects/ai-todo/apps/api
```

### 3. 生产环境变量

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

至少填写：

```bash
POSTGRES_PASSWORD=<强密码>
AI_TODO_PUBLISH_PORT=8082
AI_TODO_WECHAT_APP_ID=wx...
AI_TODO_WECHAT_APP_SECRET=...
AI_TODO_ALLOW_DEV_AUTH=false
```

### 4. xiaolin-gateway（HTTPS）

在 `xiaolin-gateway` 仓库配置 `wodi.games` → 宿主机 `:8082`，证书放 `app/ai-todo/cert/`。  
**不要**在 ai-todo 侧启用 Caddy（`docker-compose.tls.yml`）。

### 5. 首次手动部署 API

```bash
bash deploy/remote-deploy.sh
curl -sf http://127.0.0.1:8082/v1/health
curl -sf https://wodi.games/v1/health
curl -sf https://wodi.games/v1/health/db
```

若 Docker 构建 `pip install` 失败，见 [deploy.md](./deploy.md)「Docker 构建失败」— 使用腾讯云 PyPI 镜像。

### 6. 部署 gateway

```bash
cd ~/AgentProjects/xiaolin-gateway
git pull
docker compose up -d
```

`docker compose up -d` 会重建/重启 Nginx 容器并加载最新配置，**无需**再执行 `docker exec nginx -s reload`。

---

## 三、GitHub Actions（CI / CD）

详见 [ci-cd.md](./ci-cd.md)。CI 产出 `deploy-manifest`（含 API 镜像 digest 指纹）；CD 仅手动触发，消费指定 CI run 的制品，并在 VPS 上 **优先 pull GHCR 镜像**（`deploy_mode=auto` 时 pull 失败会自动 `compose build`）。手动 CD 可选 `deploy_mode`：`auto` / `pull` / `server-build`。

### Secrets（ai-todo 仓库）

| Secret | 说明 |
|--------|------|
| `DEPLOY_HOST` | VPS IP |
| `DEPLOY_USER` | SSH 用户名 |
| `DEPLOY_SSH_KEY` | SSH **私钥全文**（不是登录密码） |
| `DEPLOY_PASSWORD` | 可选：SSH 登录密码（与私钥二选一） |
| `DEPLOY_PATH` | 可选；服务器仓库路径，默认 `$HOME/AgentProjects/ai-todo` |

验证：

```bash
curl -sf https://wodi.games/v1/health
curl -sf https://wodi.games/v1/health/db
```

---

## 四、微信公众平台配置

**合法域名在公众平台后台配置，不在小程序代码中填写。**

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) 或[测试号](https://mp.weixin.qq.com/debug/cgi-bin/sandbox)
2. **开发 → 开发管理 → 开发设置 → 服务器域名**
3. **request 合法域名** 添加：`https://wodi.games`（测试号；正式号后台若只接受纯域名则填 `wodi.games`）
4. 保存，等待约 5 分钟生效

小程序代码侧只需：

- `project.config.json` 配置 AppID
- API 基址默认为 `https://wodi.games`（见 `lib/config.ts`）

---

## 五、微信小程序发布

### 开发 / 体验版

1. 微信开发者工具导入 `apps/miniapp`，配置测试号 AppID
2. 关闭「不校验合法域名」后真机测试 **微信登录**
3. 上传代码 → 体验版 → 扫码验证

### 正式版提审

1. 确认 `https://wodi.games/v1/health` 与登录流程稳定
2. 开发者工具上传 → 公众平台提审 → 发布

---

## 六、日常发布流程

### API 变更

```text
1. 本地 `pytest`（`apps/api`）、`pnpm typecheck`、`pnpm lint`、`pnpm check:wechat`
2. push/PR → main（CI 绿，并生成 deploy-manifest）
3. 若涉及小程序，开发者工具上传体验版并完成真机 smoke test
4. 手动触发 CD：`Use workflow from` 选择 `main`，填写 `release_tag`（如 `v0.1.1`），`ci_run_id` 留空，`deploy_mode=auto`
5. curl https://wodi.games/v1/health
6. curl https://wodi.games/v1/health/db
7. 查看服务器 `.deploy/current.json`，确认 `gitSha` / image digest / fingerprint 符合预期
8. 生产 smoke test（微信登录 + CLI PAT + 提醒/联系人）
```

### Gateway 变更（域名/证书/路由）

```text
1. 修改 xiaolin-gateway 仓库
2. push main → gateway CD
3. curl https://wodi.games/v1/health
```

### 小程序变更

```text
1. pnpm check:wechat
2. 开发者工具上传 → 体验版验证 → 提审
```

---

## 七、回滚

### API

自动回滚：manifest 部署后如果健康检查失败（含启动等待超时），脚本会读取上一版 `.deploy/current.json`，按上一版 `deployMode`（pull 或 server-build）恢复，并重新健康检查。回滚成功后，`.deploy/current.json` 会标记为 `status: rolled_back`。

手动回滚：触发 GitHub Actions 的 `CD` workflow，填写要回滚到的旧 `ci_run_id`。CD 会下载该次 CI 的 `deploy-manifest`，校验 fingerprint，并按旧镜像 digest 部署。日常发布不需要填写 `ci_run_id`，只填写 `release_tag`，CD 会自动解析 tag 指向 commit 的成功 CI。

应急方式（GitHub Actions 不可用时）：在服务器本地执行 `remote-deploy.sh`。这种方式会在服务器上 build，速度和可追溯性都弱于 manifest 部署。

注意：应用回滚不会回滚 PostgreSQL volume 中已经执行过的 schema/data migration。数据库变更必须按向前兼容方式设计，避免“新版本迁移后旧版本无法启动”。迁移规范见 [database-migrations.md](./database-migrations.md)。

### 数据库备份

```bash
docker compose -f apps/api/docker-compose.prod.yml exec postgres \
  pg_dump -U ai_todo ai_todo > backup-$(date +%F).sql
```

---

## 八、上线前 Checklist

**服务器**

- [ ] API health：`curl http://127.0.0.1:8082/v1/health`
- [ ] DB health：`curl http://127.0.0.1:8082/v1/health/db`，确认 `status=ok`
- [ ] Gateway health：`curl https://wodi.games/v1/health`
- [ ] Gateway DB health：`curl https://wodi.games/v1/health/db`
- [ ] `.deploy/current.json` 中的 `gitSha` / `apiDigest` / `fingerprint` / `deployMode` 与本次 CI 一致
- [ ] `.env.production` 中 `AI_TODO_ALLOW_DEV_AUTH=false`
- [ ] 微信 AppID / AppSecret 正确
- [ ] 若本次包含 Alembic migration，确认符合 expand/deploy/backfill/contract 策略

**微信**

- [ ] 公众平台 request 合法域名已填（测试号：`https://wodi.games`）
- [ ] 体验版微信登录 + 四个 Tab 正常
- [ ] 真机（关闭域名校验绕过）测试通过

**安全**

- [ ] Postgres 不对公网暴露
- [ ] 8082 仅内网/gateway 访问（安全组不对外开放）

---

## 九、故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| Docker build pip 失败 | PyPI 网络超时 | 使用腾讯云镜像，见 deploy.md |
| `password authentication failed` | `.env` 密码与 Postgres 卷不一致 | `python3 scripts/rotate_postgres_password.py`，见 deploy.md |
| health 502 | gateway 未启动或 upstream 端口错 | 检查 `:8082` 与 gateway conf |
| 微信登录 503 | 未配 AppID/Secret | 检查 `.env.production` |
| 微信登录 500 / FK `identities_user_id_fkey` | 先写 `users` 再写 `identities` 失败或脏数据 | 见下方「微信登录 FK 修复」；部署最新 API 后重试 |
| 微信登录 500 `DATABASE_ERROR` | 未跑迁移 | `docker compose ... exec api alembic upgrade head`；确认 `/v1/health/db` 中 `identitiesTable: true` |
| 微信登录 500 其他 | AppID 与小程序不一致、库异常 | 对齐 AppID/Secret；查 API 日志 |
| 小程序 request 失败 | 合法域名未配 | 公众平台填 `wodi.games` |

### 微信登录 FK 修复（`identities_user_id_fkey`）

日志若出现 `Key (user_id)=(...) is not present in table "users"`：

```bash
cd ~/AgentProjects/ai-todo/apps/api

# 1. 清理孤儿 identity（有 identity 无 user）
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  psql -U ai_todo -d ai_todo -c \
  "DELETE FROM identities i WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id);"

# 2. 查看迁移状态（若 upgrade head 失败，把完整报错保存下来）
docker compose -f docker-compose.prod.yml --env-file .env.production exec api alembic current
docker compose -f docker-compose.prod.yml --env-file .env.production exec api alembic upgrade head

# 3. 拉取含 wechat 修复的代码并重建 API
cd ~/AgentProjects/ai-todo && git pull
cd apps/api
docker compose -f docker-compose.prod.yml --env-file .env.production build api
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api
```

小程序侧：**清除 Token → 再点一次微信登录**（每次都会换新 `code`）。

若 `alembic upgrade head` 在 `20260526_0009` 失败，可先确认是否已到 `20260521_0008`（含 `identities` 表）；微信登录不依赖 `0009`，但 API 镜像若含 `username` 字段则必须完成 `0009` 或保持镜像与库版本一致。

---

## 十、相关文件

| 文件 | 作用 |
|------|------|
| `apps/api/Dockerfile` | API 镜像（支持 `PIP_INDEX_URL`） |
| `apps/api/docker-compose.prod.yml` | API + Postgres，宿主机 :8082 |
| `apps/api/deploy/remote-deploy.sh` | VPS 部署脚本 |
| `xiaolin-gateway/app/ai-todo/` | HTTPS 与反代配置 |
