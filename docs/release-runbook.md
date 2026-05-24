# ai-todo 发布上线操作手册

本文是 **从 0 到上线** 的 checklist，包含 API 部署（GitHub Actions）与微信小程序发布。

相关文档：

- 部署细节：[deploy.md](./deploy.md)
- 小程序开发：[../apps/miniapp/README.md](../apps/miniapp/README.md)
- 网关配置：[xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway)

---

## 一、架构概览

```text
开发者 push main
    → GitHub Actions CI（pytest + check:wechat）
    → CI 通过后 Deploy 工作流 SSH 到 VPS
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
| API + Postgres | GitHub Actions → VPS Docker | 每次 merge `main` |
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

## 三、GitHub Actions 自动部署

### Secrets（ai-todo 仓库）

| Secret | 说明 |
|--------|------|
| `DEPLOY_HOST` | VPS IP |
| `DEPLOY_USER` | SSH 用户名 |
| `DEPLOY_SSH_KEY` | SSH 私钥 |
| `DEPLOY_PATH` | 如 `~/AgentProjects/ai-todo` |

验证：

```bash
curl -sf https://wodi.games/v1/health
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
1. 本地 pytest / pnpm check:wechat
2. PR → main（CI 绿）
3. merge 后自动 SSH 部署
4. curl https://wodi.games/v1/health
5. 小程序 smoke test（微信登录 + 提醒列表）
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

```bash
cd ~/AgentProjects/ai-todo
git reset --hard <good-commit>
bash apps/api/deploy/remote-deploy.sh
```

### 数据库备份

```bash
docker compose -f apps/api/docker-compose.prod.yml exec postgres \
  pg_dump -U ai_todo ai_todo > backup-$(date +%F).sql
```

---

## 八、上线前 Checklist

**服务器**

- [ ] API health：`curl http://127.0.0.1:8082/v1/health`
- [ ] Gateway health：`curl https://wodi.games/v1/health`
- [ ] `.env.production` 中 `AI_TODO_ALLOW_DEV_AUTH=false`
- [ ] 微信 AppID / AppSecret 正确

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
| health 502 | gateway 未启动或 upstream 端口错 | 检查 `:8082` 与 gateway conf |
| 微信登录 503 | 未配 AppID/Secret | 检查 `.env.production` |
| 小程序 request 失败 | 合法域名未配 | 公众平台填 `wodi.games` |

---

## 十、相关文件

| 文件 | 作用 |
|------|------|
| `apps/api/Dockerfile` | API 镜像（支持 `PIP_INDEX_URL`） |
| `apps/api/docker-compose.prod.yml` | API + Postgres，宿主机 :8082 |
| `apps/api/deploy/remote-deploy.sh` | VPS 部署脚本 |
| `xiaolin-gateway/app/ai-todo/` | HTTPS 与反代配置 |
