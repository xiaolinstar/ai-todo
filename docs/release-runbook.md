# ai-todo 发布上线操作手册

本文是 **从 0 到上线** 的完整 checklist，包含 API 自动部署（GitHub Actions）与微信小程序提审发布。

相关文档：

- 基础设施与 HTTPS：[deploy.md](./deploy.md)
- 小程序开发：[../apps/miniapp/README.md](../apps/miniapp/README.md)

---

## 一、架构概览

```text
开发者 push main
    → GitHub Actions CI（pytest + check:wechat）
    → CI 通过后 Deploy 工作流 SSH 到 VPS
    → git pull + docker compose up --build
    → https://api.example.com/v1/health

微信用户打开小程序
    → wx.login → POST /v1/auth/wechat/login
    → 获得 PAT → 调用 /v1/reminders 等 API
```

**API 与小程序是两条发布线：**

| 组件 | 发布方式 | 频率 |
|------|----------|------|
| API + Postgres | GitHub Actions → VPS Docker | 每次 merge `main` |
| 微信小程序 | 微信开发者工具上传 → 公众平台提审 | 功能变更时 |

---

## 二、一次性准备（VPS）

### 1. 安装依赖

```bash
# Ubuntu 示例
sudo apt update && sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"
# 重新登录使 docker 组生效
```

### 2. 克隆仓库

```bash
sudo mkdir -p /opt/ai-todo && sudo chown "$USER":"$USER" /opt/ai-todo
git clone https://github.com/<your-org>/ai-todo.git /opt/ai-todo
cd /opt/ai-todo/apps/api
```

### 3. 生产环境变量（仅保存在服务器，勿提交 Git）

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

编辑 `.env.production`，至少填写：

```bash
POSTGRES_PASSWORD=<强密码>
AI_TODO_WECHAT_APP_ID=wx...
AI_TODO_WECHAT_APP_SECRET=...
AI_TODO_ALLOW_DEV_AUTH=false
API_DOMAIN=api.example.com
```

### 4. HTTPS（Caddy）

```bash
cp deploy/Caddyfile.example deploy/Caddyfile
# 确认 API_UPSTREAM=api:3100
```

### 5. 首次手动部署（验证通过后再开 CI）

```bash
bash deploy/remote-deploy.sh
curl -sf http://127.0.0.1:3100/v1/health
curl -sf https://api.example.com/v1/health
```

### 6. 部署用户 SSH 密钥

在 VPS 上为 GitHub Actions 创建专用 deploy 用户（推荐）：

```bash
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh
# 将 GitHub Actions 使用的公钥写入 authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /opt/ai-todo
```

---

## 三、GitHub Actions 自动部署配置

### 1. CI 工作流

`.github/workflows/ci.yml` — 每次 push/PR 到 `main` 运行测试。

### 2. Deploy 工作流

`.github/workflows/deploy.yml` — 在 **CI 成功** 后自动部署，也支持 **手动触发**（Actions → Deploy → Run workflow）。

### 3. 配置 GitHub Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret | 说明 | 示例 |
|--------|------|------|
| `DEPLOY_HOST` | VPS IP 或域名 | `203.0.113.1` |
| `DEPLOY_USER` | SSH 用户名 | `deploy` |
| `DEPLOY_SSH_KEY` | SSH 私钥（PEM 全文） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PORT` | SSH 端口（可选） | `22` |
| `DEPLOY_PATH` | 仓库路径（可选） | `/opt/ai-todo` |

### 4. 配置 Environment（推荐）

**Settings → Environments → New environment → `production`**

可选开启：

- Required reviewers（部署前人工批准）
- Deployment branches：仅 `main`

Deploy 工作流已绑定 `environment: production`。

### 5. 验证自动部署

```bash
# 本地改一个小改动 merge 到 main，或 Actions 里手动 Run Deploy
# VPS 上确认：
cd /opt/ai-todo && git log -1 --oneline
curl -sf https://api.example.com/v1/health
```

---

## 四、微信公众平台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. **开发 → 开发管理 → 开发设置 → 服务器域名**
3. **request 合法域名** 添加：`api.example.com`（不要 `https://` 前缀）
4. 保存，等待约 5 分钟生效

---

## 五、微信小程序发布

### 开发 / 体验版

1. 微信开发者工具导入 `apps/miniapp`
2. **我的** 页 API 地址改为 `https://api.example.com`
3. 点击 **微信登录** 验证
4. 上传代码 → 选为体验版 → 扫码体验

### 正式版提审

1. 确认 API 生产环境稳定（health + 登录 + 核心 Tab 功能）
2. 关闭开发者工具「不校验合法域名」，真机再测一遍
3. 开发者工具 → **上传**（填写版本号与备注）
4. 公众平台 → **管理 → 版本管理 → 提交审核**
5. 审核通过后 **发布**

### 小程序侧无需随 API 每次 redeploy

- API 地址存在用户本地 storage，默认需用户在「我的」页配置一次
- 若域名不变，后续 API 自动部署对用户透明
- 仅当小程序 UI/逻辑变更时才需重新上传提审

---

## 六、日常发布流程（推荐）

### API 变更

```text
1. 本地开发 + pytest / pnpm check:wechat
2. PR → main（CI 绿）
3. merge 后 Deploy 工作流自动 SSH 部署
4. 验证 https://api.example.com/v1/health
5. 小程序 smoke test（登录 + 提醒列表）
```

### 小程序变更

```text
1. pnpm check:wechat
2. 开发者工具上传
3. 体验版验证 → 提审 → 发布
```

---

## 七、回滚

### API 回滚（VPS）

```bash
cd /opt/ai-todo
git log --oneline -5          # 找到上一个 good commit
git reset --hard <commit-sha>
bash apps/api/deploy/remote-deploy.sh
```

或在 GitHub revert commit 后重新 merge，触发自动部署。

### 数据库

Alembic 迁移在 `remote-deploy.sh` 启动时自动 `upgrade head`。  
若需降级迁移，需手动 SSH 执行 `alembic downgrade -1`（谨慎操作，先备份 DB）。

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U ai_todo ai_todo > backup-$(date +%F).sql
```

---

## 八、上线前 Checklist

**服务器**

- [ ] Docker / Compose 可用
- [ ] `.env.production` 已配置且 `AI_TODO_ALLOW_DEV_AUTH=false`
- [ ] HTTPS 证书有效（`curl https://api.example.com/v1/health`）
- [ ] 微信 AppID / AppSecret 正确

**GitHub**

- [ ] CI 通过
- [ ] Deploy Secrets 已配置
- [ ] 至少成功跑过一次 Deploy

**微信**

- [ ] request 合法域名已添加
- [ ] 体验版登录 + 四个 Tab 核心流程 OK
- [ ] 真机（关闭域名校验绕过）测试通过

**安全**

- [ ] API 仅监听 `127.0.0.1:3100`（compose 默认）
- [ ] Postgres 不对公网暴露
- [ ] SSH 密钥仅 deploy 用户，禁用密码登录（建议）

---

## 九、故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| Deploy 失败 SSH | Secret / 防火墙 / 密钥 | 检查 `DEPLOY_*`，VPS `ufw allow 22` |
| health 502 | Caddy 未启动或域名错误 | `docker compose logs caddy api` |
| 微信登录 503 | 未配 AppID/Secret | 检查 `.env.production` |
| 微信登录 429 | 限流过严 | 调 `AI_TODO_RATE_LIMIT_WECHAT_LOGIN_PER_MINUTE` |
| 小程序 request 失败 | 合法域名未配 / 证书问题 | 公众平台域名 + 真机调试 |

---

## 十、相关文件

| 文件 | 作用 |
|------|------|
| `.github/workflows/ci.yml` | 测试 |
| `.github/workflows/deploy.yml` | 自动部署 |
| `apps/api/deploy/remote-deploy.sh` | VPS 部署脚本 |
| `apps/api/docker-compose.prod.yml` | API + Postgres |
| `apps/api/docker-compose.tls.yml` | Caddy TLS 叠加 |
| `docs/deploy.md` | 部署细节 |
