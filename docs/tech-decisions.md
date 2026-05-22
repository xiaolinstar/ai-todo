# ai-todo 技术决策

日期：2026-05-20（持续更新）

## 产品焦点

**本项目专注「功能本身」**：可靠的提醒、日历、联系人数据与 API/CLI，不内置大模型自然语言解析。

AI 交互交给用户已有的 Agent 环境（OpenClaw、Claude Code/Codex、Cursor 等），通过：

- **CLI**：结构化命令 + `--json` 输出
- **Skills / MCP（规划）**：把 CLI 或 HTTP API 封装成 Agent 可调用的工具

因此 **不做**（或明确推迟、且可能永久不做）：

- `POST /v1/nl/parse` 等服务端自然语言入口
- CLI 的 `parse` / `ask` 等依赖内置模型的命令
- 服务端联系人 LLM 消歧（`POST /v1/contacts/resolve` 的 NLP 版本）

Agent 侧自然语言 → 时间/意图理解，由 **外部模型 + Skills** 完成，再调用本项目的结构化接口，例如：

```bash
ai-todo add "…"           # 仅当 Agent 已解析为 title/due 时，应优先用结构化 API
ai-todo reminder create --title "…" --due "…"   # 推荐路径（待 CLI 补齐子命令）
curl POST /v1/reminders   # 最直接
```

联系人场景：Agent 用 `contact search` / `GET /v1/contacts?q=` 做匹配，重名时向用户确认，而非服务端 NL。

## 已确认

### 微信小程序

- **技术栈：微信原生**（TypeScript + Sass，对齐 party-helper，见 `docs/miniapp-conventions.md`）
- 优先级低于 CLI/Skills；MVP 页面：今日、创建提醒、完成、联系人（见 `apps/miniapp/README.md`）

### 认证与用户

- **MVP：固定开发用户**，不实现微信登录与 CLI Token
- 默认用户 ID：`user_dev`（可通过 `AI_TODO_DEV_USER_ID` 配置）
- 所有业务数据按 `user_id` 隔离；后续再接入微信登录与 Bearer Token
- 当前请求无需 `Authorization` 头，服务端自动解析为开发用户

### 后端

- Python + FastAPI + PostgreSQL + Alembic
- **Reminder / Calendar / Contacts MVP 已实现**（含 `/v1/today` 聚合、软删除、用户隔离）
- 本地开发用户由应用启动时 `ensure_dev_user` 与迁移种子共同保证存在

## 推荐推进顺序（修订）

1. **CLI 与 Agent 体验**：✅ 结构化 `reminder`/`calendar`/`contact` 子命令、`--json`、`login`/`whoami`、本地 `~/.ai-todo/config.json`
2. **Skills / MCP**：✅ `skills/ai-todo/SKILL.md` + `docs/agent-usage.md` + `@ai-todo/agent-protocol` 工具表
3. **API 硬化**：✅ CLI Token（`POST/GET/DELETE /v1/api-tokens`）、幂等键、`CommandLog`
4. **关联能力**：✅ `reminder ↔ contact`、`calendar ↔ contact`（`contact_ids` / `contacts[]` 摘要）
5. **Agent 闭环补全**：✅ `calendar update`、`contact update`、`logout`、PAT 认证 UX（`AI_TODO_TOKEN` / `login --token` / `login --issue-pat`）
6. **微信小程序**：✅ MVP 原生小程序（提醒 / 日历 / 通讯录 / 我的），见 `apps/miniapp/README.md`
7. **生产部署（C1）**：✅ API Dockerfile + `docker-compose.prod.yml`，见 `docs/deploy.md`
8. ~~自然语言解析~~：**不在路线图**

## 认证策略（2026-05-21）

**Agent / CLI 采用 PAT 模式**（类似 GitHub PAT、`OPENAI_API_KEY`）：

- 用户在生产环境通过 Web 控制台或小程序创建 PAT，写入 `AI_TODO_TOKEN`
- 本地开发可用 `ai-todo login --issue-pat` 一次性签发（依赖 dev 旁路）
- **不做** CLI `token list/revoke` 子命令——Token 生命周期由控制台 / 小程序管理

**规划中**（Phase C+）：OAuth 授权链接或扫码登录（类似 `gh auth login`），CLI 检测到未授权时引导用户完成浏览器授权，自动写入 Token。

## 待后续决定

- CLI Token 创建入口（小程序 vs Web 控制台 vs OAuth 扫码）
- MCP Server 独立包 vs 仅维护 Skill 文档 + 调用 CLI
- `contact resolve` 是否做纯规则/搜索版（无 LLM）

## 文档说明

`docs/initial-planning.md`、`api-design.md`、`cli-design.md` 中仍有早期「自然语言 MVP」描述，以 **本文「产品焦点」** 为准；后续迭代文档时应将 NL 章节标为「已放弃 / 由 Agent 承担」。
