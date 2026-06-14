# ai-todo 开发者手册

本文说明本地开发环境和生产环境的配置方式，重点覆盖微信小程序 AppID、微信登录、API 地址、后端环境变量和提醒触达 worker。

微信小程序提审或新增隐私相关能力前，先检查 [微信小程序隐私报备清单](privacy-compliance.md)。

## 能力状态

微信登录已经支持。

当前登录链路：

```text
小程序 wx.login
  → POST /v1/auth/wechat/login
  → 服务端 code2session 换 openid
  → users / identities 建立或复用用户
  → 签发 session token
  → 小程序保存 token，后续请求带 Authorization: Bearer ...
```

本地开发如果未配置 `AI_TODO_WECHAT_APP_ID` / `AI_TODO_WECHAT_APP_SECRET`，且 `AI_TODO_ALLOW_DEV_AUTH=true`，服务端会降级为开发用户登录，方便不接微信也能开发。

生产环境必须配置真实微信 AppID / AppSecret，并关闭开发用户旁路。

## 配置分层

| 配置 | 放在哪里 | 是否提交 | 说明 |
|------|----------|----------|------|
| 小程序共享工程配置 | `apps/miniapp/project.config.json` | 是 | 固定使用 `touristid`，不放真实 AppID |
| 小程序本地 AppID | `apps/miniapp/project.private.config.json` | 否 | 本地覆盖真实 AppID，已被 `.gitignore` 忽略 |
| 小程序 private 示例 | `apps/miniapp/project.private.config.example.json` | 是 | 给开发者复制使用 |
| API 本地环境变量 | shell / 本地 `.env` 载入方式 | 否 | 数据库、dev auth、可选微信密钥 |
| API 生产环境变量 | `apps/api/.env.production` | 否 | 生产数据库、微信 AppSecret、端口等 |
| API 环境变量模板 | `.env.example` / `.env.production.example` | 是 | 只放字段名和默认值，不放真实密钥 |

AppID 不算密钥，但当前项目采用策略 B：共享配置不提交真实 AppID，本地用 private config 覆盖。

AppSecret 是密钥，永远只放后端环境变量，不放小程序工程配置。

## 本地开发环境

### 1. 小程序 AppID

复制 private 配置：

```bash
cp apps/miniapp/project.private.config.example.json apps/miniapp/project.private.config.json
```

如果只是开发 UI 或走开发用户旁路，可以继续使用示例 AppID 或 `touristid`。

如果要测试真实微信登录，必须改成正式小程序 AppID：

```json
{
  "appid": "wx你的真实小程序AppID",
  "setting": {
    "urlCheck": false
  }
}
```

### 2. 本地 Docker Compose 启动 API

推荐本地多服务开发直接使用 Docker Compose，统一启动 Postgres 和 API：

```bash
cd apps/api
cp .env.local.example .env.local
docker compose --env-file .env.local up -d --build
```

API 启动时会自动等待 Postgres 并执行 Alembic 迁移。默认监听：

```text
http://127.0.0.1:3100
```

停止本地服务：

```bash
docker compose --env-file .env.local stop
```

如果需要启用本地提醒 worker：

```bash
docker compose --env-file .env.local --profile notifications up -d --build
```

### 3. 本机 Python 开发 API（可选）

如果正在调试 Python 代码，也可以只用 Compose 启动 Postgres，再用本机虚拟环境跑 API：

```bash
cd apps/api
docker compose --env-file .env.local up -d postgres
.venv/bin/alembic upgrade head
cd ../..
pnpm dev:api
```

这种方式适合后端代码热调试；多服务联调仍建议优先用完整 Docker Compose。

开发者工具 **模拟器**（`platform === devtools`）下，小程序默认访问：

```text
http://127.0.0.1:3100
```

手机扫 **预览** 或 **真机调试** 二维码时，虽仍是微信 `develop` 构建，但会自动连 **staging**：

```text
https://staging.xingxiaolin.cn
```

与体验版共用预发布后端，便于真机验收；模拟器仍走本地 API 以便热调试。仅模拟器可保存自定义 API 地址（如局域网 IP）；体验版/正式版/手机 develop 均固定远程地址。

### 4. 本地免微信登录开发

默认 `.env.local.example` 的开发策略是：

```bash
AI_TODO_ALLOW_DEV_AUTH=true
```

在这种模式下：

- 小程序开发者工具里可不点微信登录，也能访问 API；
- `/v1/auth/wechat/login` 在未配置微信密钥时会返回开发用户 session token；
- 业务数据归属 `user_dev`。

这适合开发 UI、CRUD、CLI 和 API 流程。

### 5. 本地真实微信登录测试

如果要本地测试真实微信登录，必须同时满足：

```bash
AI_TODO_WECHAT_APP_ID=wx你的真实小程序AppID
AI_TODO_WECHAT_APP_SECRET=你的小程序AppSecret
```

并且 `project.private.config.json` 里的 `appid` 必须是同一个 AppID。

重启 API 后生效：

```bash
docker compose --env-file .env.local up -d --build
```

注意：

- `wx.login` 产生的 code 与当前小程序 AppID 绑定；
- 后端 AppID / AppSecret 不一致会导致 code2session 失败；
- 本地真实微信登录可以继续使用 `127.0.0.1:3100`，开发者工具需关闭合法域名校验。

### 6. 本地提醒触达测试

服务端通知记录能力已支持，但真实微信订阅消息需要模板 ID 和 openid。

本地功能闭环可以不启用 worker。需要运行 worker 时使用：

```bash
docker compose --env-file .env.local --profile notifications up -d --build
```

没有真实微信 identity 时，到期投递会按预期标记为：

```text
WECHAT_OPENID_MISSING
```

如果要测真实订阅消息，还需要：

```bash
AI_TODO_WECHAT_REMINDER_TEMPLATE_ID=微信订阅消息模板ID
```

并确认公众平台模板字段与 worker 中的字段映射一致。

## 生产环境

生产环境配置在服务器：

```bash
apps/api/.env.production
```

至少需要：

```bash
POSTGRES_PASSWORD=强密码
AI_TODO_PUBLISH_PORT=8082
AI_TODO_ALLOW_DEV_AUTH=false
AI_TODO_WECHAT_APP_ID=wx你的正式小程序AppID
AI_TODO_WECHAT_APP_SECRET=你的小程序AppSecret
```

可选提醒触达：

```bash
AI_TODO_WECHAT_REMINDER_TEMPLATE_ID=微信订阅消息模板ID
```

生产必须关闭：

```bash
AI_TODO_ALLOW_DEV_AUTH=false
```

否则未登录请求会落到开发用户，存在数据隔离风险。

## 生产小程序配置

微信公众平台需要配置 request 合法域名：

```text
xingxiaolin.cn
```

或在部分后台页面填写：

```text
https://xingxiaolin.cn
```

生产/体验版小程序固定访问：

```text
https://xingxiaolin.cn
```

代码位置：

```text
apps/miniapp/miniprogram/lib/config.ts
```

## 生产部署

常规 API 部署：

```bash
cd apps/api
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

默认不会启动提醒触达 worker。

如果后续要启用真实提醒投递：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production --profile notifications up -d
```

## 验证命令

本地提交前：

```bash
pnpm typecheck
pnpm build
pnpm check:wechat
pnpm test:api
```

### VS Code / Cursor 运行测试

仓库已包含 `.vscode/settings.json`，用于在 **Testing** 视图中发现并运行 `apps/api` 下的 pytest 用例（与 `pnpm test:api` 中的 pytest 部分一致；CLI 集成测试仍会先 build CLI，IDE 直接跑 pytest 时依赖已有 `apps/cli/dist` 或由用例内构建）。

**前置条件**

1. 安装推荐扩展：Python、Pylance（打开工作区时按提示安装，或见 `.vscode/extensions.json`）。
2. 创建 API 虚拟环境并安装 dev 依赖：

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

3. 命令面板 → **Python: Select Interpreter** → 选择 `apps/api/.venv/bin/python`。

**工作区关键配置**

| 设置 | 值 | 说明 |
|------|-----|------|
| `python.defaultInterpreterPath` | `apps/api/.venv/bin/python` | 使用 API 虚拟环境 |
| `python.testing.cwd` | `apps/api` | 在 API 目录执行 pytest，才能加载 `pyproject.toml` 中的 `testpaths` / `pythonpath` |
| `python.testing.pytestArgs` | `[]` | 不要从仓库根传入 `apps` 等路径，否则易出现 `ModuleNotFoundError: No module named 'tests'` |
| `python.testing.pytestEnabled` | `true` | 启用 pytest 发现 |

**使用方式**

- 左侧 **Testing** 面板刷新后，应看到 `apps/api/tests` 下的用例；可运行单个测试或全部测试。
- 命令行完整验证（含 CLI build）仍用：`pnpm test:api`。

**若 Testing 面板为空**

- 确认解释器为 `apps/api/.venv`。
- 执行 **Test: Refresh Tests** 或 **Developer: Reload Window**。
- 在终端验证：`cd apps/api && .venv/bin/python -m pytest -q` 应能收集并通过用例。

生产部署与 CD 详见 [deploy.md](./deploy.md)、[ci-cd.md](./ci-cd.md)、[release-runbook.md](./release-runbook.md)。国内 VPS + GHCR 常见问题见 [deploy-troubleshooting.md](./deploy-troubleshooting.md)。部署成功后可在 VPS 查看 `.deploy/current.json` 中的 `deployMode`（`pull` / `server-build-fallback` 等）。

生产部署后：

```bash
curl https://xingxiaolin.cn/v1/health
curl https://xingxiaolin.cn/v1/health/db
```

小程序体验版至少验证：

- 微信登录成功；
- 创建提醒；
- 完成提醒；
- 左滑删除提醒；
- 创建日程；
- 创建联系人；
- 我的页连接状态正常。

## 常见问题

### 微信登录 503：`WECHAT_NOT_CONFIGURED`

生产环境未配置：

```bash
AI_TODO_WECHAT_APP_ID
AI_TODO_WECHAT_APP_SECRET
```

### 微信登录失败或 code 无效

检查三处是否一致：

- 微信开发者工具使用的 AppID；
- `project.private.config.json` 中的 AppID；
- 后端 `AI_TODO_WECHAT_APP_ID`。

### 本地开发为什么不需要登录也能访问？

因为本地默认 `AI_TODO_ALLOW_DEV_AUTH=true`，后端允许开发用户旁路。生产必须关闭。

### 为什么改了环境变量不生效？

API 配置在进程启动时读取。修改环境变量后需要重启 API；Docker 环境还需要重新 `up -d` 对应服务。
