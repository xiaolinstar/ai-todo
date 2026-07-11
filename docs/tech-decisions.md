# ai-todo 技术决策

日期：2026-05-20（持续更新；2026-05-25 确认自然语言解析不进入路线图）

## 产品焦点

**本项目专注「功能本身」**：可靠的提醒、日历、联系人数据与 API/CLI，不内置大模型自然语言解析。

AI 交互交给用户已有的 Agent 环境（OpenClaw、Claude Code/Codex、Cursor 等），通过：

- **CLI**：结构化命令 + `--json` 输出
- **Skills / MCP（规划）**：把 CLI 或 HTTP API 封装成 Agent 可调用的工具

因此 **不做**：

- `POST /v1/nl/parse` 等服务端自然语言入口
- CLI 的 `parse` / `ask` 等依赖内置模型的命令
- 服务端联系人 LLM 消歧（`POST /v1/contacts/resolve` 的 NLP 版本）
- 把“用户自然语言 → 意图/时间/联系人/动作”的解析逻辑放进本项目

Agent 侧自然语言 → 时间/意图理解，由 **外部模型 + Skills** 完成，再调用本项目的结构化接口，例如：

```bash
ai-todo add "…"           # 仅当 Agent 已解析为 title/due 时，应优先用结构化 API
ai-todo reminder create --title "…" --due "…"   # 推荐路径（待 CLI 补齐子命令）
curl POST /v1/reminders   # 最直接
```

联系人场景：Agent 用 `contact search` / `GET /v1/contacts?q=` 做匹配，重名时向用户确认，而非服务端 NL。

### 长期规划护栏

后续规划时默认遵守：

- 不再把“自然语言解析并执行”作为 ai-todo 的路线图事项
- 不再规划内置 LLM、Prompt 编排、模型调用、意图识别、时间解析或联系人语义消歧
- 允许规划 **CLI / Skill / MCP / HTTP API** 能力，让外部 Agent 更稳定地调用本项目
- 允许提供结构化搜索、CRUD、批量操作、幂等、审计、权限和错误码
- 如果未来确需“解析”二字，只能指确定性的结构化校验或精确字段查询，不指 LLM/NLP 能力

## 已确认

### 用户名与通讯录标识

- `User.username`：平台级公开用户名，全局唯一，用于共享电子名片、URL、跨用户引用和未来协作。
- `Contact.handle`：当前用户个人通讯录内的本地唯一短标识，用于 CLI / Agent / MCP / URL 参数引用联系人。
- `Contact` 是用户的个人信息库条目，不一定是平台注册用户。
- 当联系人关联平台用户时，可默认使用 `User.username` 作为 `Contact.handle`，但用户可以随时修改本地 `handle`，不影响对方的 `username`。
- 唯一性：`users.username` 全局唯一；`contacts.user_id + contacts.handle` 局部唯一。

### 微信小程序

- **技术栈：微信原生**（TypeScript + Sass，对齐 party-helper，见 `docs/miniapp-conventions.md`）
- 优先级低于 CLI/Skills；MVP 页面：今日、创建提醒、完成、联系人（见 `apps/miniapp/README.md`）
- **时区解析兜底**：Windows PC 微信等环境底层 Chromium 可能缺乏完整 ICU 数据库，导致 `Intl.DateTimeFormat` 抛错。处理时区偏移时必须使用本地系统时区偏移（`getTimezoneOffset`）作为后备，**严禁兜底为 0 (UTC)**，以防止保存与读取产生完美的 8 小时不对称时差。同时需注意部分环境下 `hour12: false` 产生的 `hour === 24` 午夜解析 Bug，必须伴随日期进位（day + 1）处理。

### 认证与用户

- **生产**：微信小程序 `wx.login` → `POST /v1/auth/wechat/login` → session token；Agent/CLI 用 PAT（小程序 UI 创建，`AI_TODO_TOKEN` / `login --token`）
- **本地开发旁路**：未配置微信密钥且 `AI_TODO_ALLOW_DEV_AUTH=true` 时，可降级为固定开发用户（`user_dev`，见 `developer-guide.md`）
- 所有业务数据按 `user_id` 隔离；请求带 `Authorization: Bearer ...`（生产必需）

> 早期 MVP 曾仅固定开发用户、无微信登录——见下方「推荐推进顺序」C2 已 ✅。

### 后端

- Python + FastAPI + PostgreSQL + Alembic
- **Reminder / Calendar / Contacts MVP 已实现**（含 `/v1/today` 聚合、软删除、用户隔离）
- 本地开发用户由应用启动时 `ensure_dev_user` 与迁移种子共同保证存在

## 推荐推进顺序（修订）

1. **CLI 与 Agent 体验**：✅ 结构化 `reminder`/`calendar`/`contact` 子命令、`--json`、`login`/`whoami`、本地 `~/.ai-todo/settings.json`
2. **Skills / MCP**：✅ `skills/ai-todo/SKILL.md` + `docs/agent-usage.md` + `@ai-todo/agent-protocol` 工具表
3. **API 硬化**：✅ CLI Token（`POST/GET/DELETE /v1/api-tokens`）、幂等键、`CommandLog`
4. **关联能力**：✅ `reminder ↔ contact`、`calendar ↔ contact`（`contact_ids` / `contacts[]` 摘要）
5. **Agent 闭环补全**：✅ `calendar update`、`contact update`、`logout`、PAT 认证 UX（`AI_TODO_TOKEN` / `login --token` / `login --issue-pat`）
6. **微信小程序**：✅ MVP 原生小程序（提醒 / 日历 / 通讯录 / 我的），见 `apps/miniapp/README.md`
7. **生产部署（C1）**：✅ API Dockerfile + `docker-compose.prod.yml`，见 `docs/deploy.md`
8. **微信登录（C2）**：✅ `identities` 表 + `POST /v1/auth/wechat/login` + 小程序 `wx.login`
9. **生产硬化（C3）**：✅ HTTPS/Caddy 模板、微信合法域名文档、CI、微信登录限流
10. ~~自然语言解析~~：**不在路线图，交给调用方 Agent / Skill 实现**

## 认证策略（2026-05-21，2026-06-14 修订）

**Agent / CLI 采用 PAT 模式**（类似 GitHub PAT、`OPENAI_API_KEY`）：

- 用户在生产环境通过 **微信小程序**（我的 → Agent 令牌）创建 PAT，经 `ai-todo login --token` 或 `AI_TODO_TOKEN` 写入本机
- 本地开发可用 `ai-todo login --issue-pat` 一次性签发（依赖 `allow_dev_auth` 旁路）
- **不提供** CLI `ai-todo token` 子命令（含 list / create / revoke / revoke-all）——PAT 生命周期 **仅** 在小程序 UI 管理（v0.8.3+，见 [v0.8.3-plan.md](./releases/v0.8.3-plan.md)、[cli-design.md](./cli-design.md)）

**规划中**（Phase C+）：OAuth 授权链接或扫码登录（类似 `gh auth login`），CLI 检测到未授权时引导用户完成浏览器授权，自动写入 Token。

## 待后续决定

- OAuth / 扫码登录替代手动 `login --token` 粘贴流程
- MCP Server 独立包 vs 仅维护 Skill 文档 + 调用 CLI

## 文档说明

`docs/initial-planning.md`、`api-design.md`、`cli-design.md` 中若出现早期「自然语言 MVP」描述，以 **本文「产品焦点」** 为准；后续迭代文档时应删除或标为「已放弃 / 由 Agent 承担」。
