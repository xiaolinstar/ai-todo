# Agent 使用指南（CLI + MCP + Skills）

ai-todo **不提供**服务端自然语言解析。Agent 在本地理解用户意图后，通过 **结构化 CLI**、**MCP 工具**（支持 MCP 的 IDE / 桌面客户端）或 HTTP API 访问数据。

接入方式选型见 [mcp-setup.md § CLI 与 MCP](./mcp-setup.md#cli-与-mcp何时用哪个)：CLI 通用完整；MCP 面向支持 stdio MCP 的宿主（Cursor、Claude Desktop、VS Code MCP 等），让模型零 shell 调用固定工具集。

## 安装 CLI

```bash
npm install -g @xiaolinstar/ai-todo-cli
```

仓库内开发仍可用 `pnpm build` 后 `node apps/cli/dist/index.js`，或 `pnpm cli`。

## 认证（Personal Access Token）

与 Claude Code / OpenAI CLI 相同：**连接信息放在本地配置文件**，业务命令不再携带认证参数。

**配置文件**：`~/.ai-todo/settings.json`（示例见 `apps/cli/settings.example.json`）

```json
{
  "url": "https://xingxiaolin.cn",
  "token": "aitodo_xxx"
}
```

**首次配置（生产）**：微信小程序 → **我的 → CLI / Agent 访问令牌 → 创建** → 复制配置到 `~/.ai-todo/settings.json` → 验证：

```bash
ai-todo whoami --json
```

**优先级**：`AI_TODO_TOKEN` / `AI_TODO_API_URL` 环境变量 > `~/.ai-todo/settings.json` > 默认 `http://127.0.0.1:3100`

```bash
# Agent / CI 推荐用环境变量覆盖
export AI_TODO_TOKEN=aitodo_xxx
export AI_TODO_API_URL=https://xingxiaolin.cn
```

> 微信登录下发的是**会话 Token**（仅供小程序），不能用于 CLI。CLI 必须使用 PAT。  
> 访问令牌在小程序内创建与管理；CLI 不再对外展示 `login` / `token` 子命令。

配置完成后，日常命令**无需**再传 `--url`：

```bash
ai-todo today --json
ai-todo reminder list --json
ai-todo contact list --json
```

全局建议：

- **所有 Agent 调用加 `--json`**，解析 `ok` / `data` / `error.code`
- **写操作加 `--idempotency-key <uuid>`**（或 HTTP 头 `Idempotency-Key`），避免重试重复创建
- 使用 **Bearer PAT**（写入 settings 或环境变量），而非仅依赖开发用户旁路

## 仓库内开发（可选）

```bash
pnpm install
pnpm build
pnpm dev:api   # 另开终端
```

## 推荐工作流

### 1. 查看今天

```bash
ai-todo today --json
```

### 2. 用户说「明天十点提醒我给王总发邮件」

Agent 自行解析时间与标题，**不要**调用不存在的 `parse` 命令：

```bash
# 先搜联系人（重名则向用户确认 contact_id 或 handle）
ai-todo contact search "王总" --json

# 再创建提醒（关联联系人）
ai-todo reminder create \
  --title "给客户王总发报价确认邮件" \
  --due "2026-05-21T10:00:00+08:00" \
  --contact <contact_id_or_handle> \
  --json
```

响应中的 `data.reminder.contacts[]` 含 `displayName`、`primaryEmail`，供后续邮件类 CLI 使用，无需把邮箱写进标题。

### 3. 安排会议

```bash
ai-todo calendar add \
  --title "产品评审" \
  --contact <contact_id_or_handle> \
  --start "2026-05-20T14:00:00+08:00" \
  --end "2026-05-20T15:00:00+08:00" \
  --location "会议室 A" \
  --json
```

### 4. 查看 / 更新 / 完成 / 改期 / 删除

```bash
ai-todo reminder show rem_xxx --json
ai-todo reminder update rem_xxx --title "新标题" --notes "备注" --json
ai-todo reminder update rem_xxx --due "2026-05-22T09:00:00+08:00" --contact <contact_id_or_handle> --json
ai-todo reminder done rem_xxx --json
ai-todo reminder reschedule rem_xxx --due "2026-05-22T09:00:00+08:00" --remind "2026-05-22T08:30:00+08:00" --json
ai-todo reminder delete rem_xxx --json
```

`reminder update` 与 `reminder reschedule` 均可改 `dueAt` / `remindAt`；仅改时间时二者等价，`update` 还可同时改标题、备注与关联联系人。

## 外部来源与幂等（v0.6.0+）

邮件 Agent、工单 Agent 等外部系统写入提醒时，应使用 **`source` + `externalId`** 作为稳定业务键，而不是仅靠标题去重。

| 字段 | 含义 |
|------|------|
| `source` | 业务来源 slug，如 `email`、`jira`、`wechat`（**不是** HTTP 头 `x-client-source`） |
| `externalId` | 外部系统主键，如邮件 `Message-ID`、工单 `PROJ-123` |
| `sourceMeta` | 可选 JSON，仅展示/审计（`subject`、`from` 等）；服务端不做 NL 解析 |

### 推荐流程

```text
find --source … --external-id …
  → 存在：update / done / delete（可用 --source 代替 reminder id）
  → 不存在：create --source … --external-id … [--source-meta '…']
  → create 返回 created:false：并发下已存在，再 find 一次
```

写操作建议带 `--idempotency-key <uuid>`（或 HTTP `Idempotency-Key`），避免 Agent 重试产生重复副作用。

### 邮件 → 提醒

```bash
MSG_ID='<cabinet@example.com>'
ai-todo reminder find --source email --external-id "$MSG_ID" --json

ai-todo reminder create \
  --title "回复客户报价邮件" \
  --source email \
  --external-id "$MSG_ID" \
  --source-meta '{"subject":"Re: Quote","from":"client@example.com"}' \
  --due "2026-05-21T10:00:00+08:00" \
  --idempotency-key "$(uuidgen)" \
  --json
```

### 工单关闭 → 完成提醒

```bash
ai-todo reminder done --source jira --external-id "PROJ-123" --json
```

### 按来源浏览

```bash
ai-todo reminder list --source email --status pending --json
```

### HTTP 对照

| CLI | API |
|-----|-----|
| `reminder find --source S --external-id E` | `GET /v1/reminders/lookup?source=S&externalId=E` |
| `reminder list --source S` | `GET /v1/reminders?source=S` |
| `create … --source S --external-id E` | `POST /v1/reminders` body 含 `source`、`external_id` |

工具规格见 `@ai-todo/agent-protocol`（`AI_TODO_AGENT_TOOLS`）或 `packages/agent-protocol/dist/agent-tools.json`。

## 命令索引

| 意图 | 命令 |
|------|------|
| CLI / API 版本 | `ai-todo version --json`；API：`GET /v1/health` → `apiVersion` |
| 当前用户 | `ai-todo whoami --json` |
| 今日聚合 | `ai-todo today --json`（未完成类提醒 + 今日日程） |
| 创建提醒 | `ai-todo reminder create --title … [--due …] [--contact …] [--source …] [--external-id …]` |
| 按来源查找 | `ai-todo reminder find --source … --external-id …` |
| 提醒列表 | `ai-todo reminder list [--status pending\|in_progress\|completed\|cancelled] [--source …]` |
| 查看提醒 | `ai-todo reminder show <id>` |
| 更新提醒 | `ai-todo reminder update <id> … [--status pending\|in_progress\|completed]` 或 `--source … --external-id …` |
| 标为处理中 | `ai-todo reminder update <id> --status in_progress` |
| 完成提醒 | `ai-todo reminder done <id>` 或 `--source … --external-id …` |
| 改期提醒 | `ai-todo reminder reschedule <id> --due …` 或 `--source … --external-id …` |
| 删除提醒 | `ai-todo reminder delete <id>` 或 `--source … --external-id …` |
| 创建日程 | `ai-todo calendar add --title … --start …` |
| 更新日程 | `ai-todo calendar update <id> [--title …] [--start …]` |
| 今日日程 | `ai-todo calendar today --json` |
| 联系人列表 | `ai-todo contact list --json` |
| 搜索联系人 | `ai-todo contact search "<q>"` |
| 查看联系人 | `ai-todo contact show <id_or_handle>` |
| 创建联系人 | `ai-todo contact add "<name>" [--handle …] --email …` |
| 更新联系人 | `ai-todo contact update <id_or_handle> [--handle …] [--name …] [--email …]` |
| 删除联系人 | `ai-todo contact delete <id_or_handle>` |

完整列表：`ai-todo help`

## JSON 响应约定

成功：

```json
{ "ok": true, "data": { ... } }
```

失败（进程退出码非 0）：

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "..." }
}
```

常见 `error.code`：`VALIDATION_ERROR`、`NOT_FOUND`、`CONTACT_NOT_FOUND`。

## MCP 接入（v0.6.2+）

支持 **stdio MCP** 的宿主（不限于 Cursor：Claude Desktop、VS Code MCP、Windsurf 等）可注册 `ai-todo` server，由模型调用具名 tool，无需拼 shell。Server 内部仍执行 `ai-todo --json`，**鉴权与 CLI 相同**（PAT / `settings.json`）。

| 场景 | 建议 |
|------|------|
| 宿主已配置 MCP，且任务在 P0 工具内 | 用 MCP tools |
| 无 MCP、脚本/CI、需完整子命令 | 用 CLI + `--json` |
| OpenClaw / Claude Code 等仅 Skill | 用本指南 + `skills/ai-todo/SKILL.md` |

安装与各宿主配置：[mcp-setup.md](./mcp-setup.md)。终端用户：`npx -y @xiaolinstar/ai-todo-mcp`；仓库贡献者：`pnpm mcp:build`。

## 工具清单（程序化）

TypeScript 导出见 `@ai-todo/agent-protocol`：

```ts
import { AI_TODO_AGENT_TOOLS, AI_TODO_AGENT_GUIDELINES } from "@ai-todo/agent-protocol";
```

构建后 JSON 导出：`packages/agent-protocol/dist/agent-tools.json`（`pnpm --filter @ai-todo/agent-protocol build`）。

## 安装 Skill（无 MCP 的 Agent）

OpenClaw、Claude Code、或未配置 MCP 的宿主：将仓库内 `skills/ai-todo/` 链接或复制到 Agent 的 skills 目录，详见 `skills/ai-todo/SKILL.md`。已配置 MCP 的宿主可优先用 MCP tools，Skill 作补充。

## 本地验证（测试代替脚本灌数）

不要用 shell 脚本批量写入演示数据。请使用 pytest 集成测试（会构建 CLI、启动内存 API、验证 contact / reminder / calendar 导入）：

```bash
pnpm test:api
```

相关用例：

- `tests/test_demo_seed.py` — 经 HTTP API 导入并校验演示数据集
- `tests/test_cli_integration.py` — 经 CLI 导入联系人、提醒、**日历**，并测试 `reminder/contact show/update` 与 `calendar show/update/delete`
- `tests/test_calendar.py` — 日历 API CRUD、日期范围筛选、详情查询

## HTTP API 备选

Agent 也可直接 `curl` / `fetch` 调用 `/v1/*`，契约见 `docs/api-design.md`。CLI 与 API 字段均使用 camelCase JSON。
