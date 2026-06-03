# Agent 使用指南（CLI + Skills）

ai-todo **不提供**服务端自然语言解析。Agent（OpenClaw、Claude Code、Cursor 等）在本地理解用户意图后，调用 **结构化 CLI** 或 HTTP API。

## 前置条件

```bash
# 构建 CLI
pnpm install
pnpm build

# 启动 API（另开终端）
pnpm dev:api
```

## 认证（Personal Access Token）

与 OpenAI / Anthropic 等工具相同：**连接信息放在本地配置文件**，命令只关注业务。

**配置文件**：`~/.ai-todo/settings.json`（示例见 `apps/cli/settings.example.json`）

```json
{
  "url": "https://wodi.games",
  "token": "aitodo_xxx"
}
```

**首次配置（生产）**：微信小程序 → **我的 → CLI / Agent 访问令牌 → 创建**，然后：

```bash
ai-todo login --url https://wodi.games --token aitodo_xxx
ai-todo whoami --json
```

**优先级**：`AI_TODO_TOKEN` / `AI_TODO_API_URL` 环境变量 > `~/.ai-todo/settings.json` > 默认 `http://127.0.0.1:3100`

```bash
# Agent / CI 仍可用环境变量覆盖（推荐）
export AI_TODO_TOKEN=aitodo_xxx
export AI_TODO_API_URL=https://wodi.games

# 本地开发一次性签发（仅 127.0.0.1 API）
ai-todo login --issue-pat --name "My Agent"

# 退出（清除 settings.json 中的 token；环境变量需 unset AI_TODO_TOKEN）
ai-todo logout
```

> 微信登录下发的是**会话 Token**（仅供小程序），不能用于 CLI。CLI 必须使用 PAT。

配置完成后，日常命令**无需**再传 `--url`：

```bash
ai-todo today --json
ai-todo reminder list --json
ai-todo contact list --json
```

全局建议：

- **所有 Agent 调用加 `--json`**，解析 `ok` / `data` / `error.code`
- **写操作加 `--idempotency-key <uuid>`**（或 HTTP 头 `Idempotency-Key`），避免重试重复创建
- 使用 **Bearer Token**（`ai-todo login --token …`）而非仅依赖开发用户旁路

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

## 命令索引

| 意图 | 命令 |
|------|------|
| CLI / API 版本 | `ai-todo version --json`；API：`GET /v1/health` → `apiVersion` |
| 当前用户 | `ai-todo whoami --json` |
| 更新当前用户资料 | `ai-todo profile update --name <text> [--avatar-url <url>] --json` |
| 今日聚合 | `ai-todo today --json` |
| 创建提醒 | `ai-todo reminder create --title … [--due …] [--contact …]` |
| 提醒列表 | `ai-todo reminder list [--status pending]` |
| 查看提醒 | `ai-todo reminder show <id>` |
| 更新提醒 | `ai-todo reminder update <id> [--title …] [--notes …] [--due …] [--remind …] [--contact …]` |
| 完成提醒 | `ai-todo reminder done <id>` |
| 改期提醒 | `ai-todo reminder reschedule <id> --due … [--remind …]` |
| 删除提醒 | `ai-todo reminder delete <id>` |
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

## 工具清单（程序化）

TypeScript 导出见 `@ai-todo/agent-protocol`：

```ts
import { AI_TODO_AGENT_TOOLS, AI_TODO_AGENT_GUIDELINES } from "@ai-todo/agent-protocol";
```

## 安装 Skill（Cursor / Claude）

将仓库内 `skills/ai-todo/` 链接或复制到 Agent 的 skills 目录，详见 `skills/ai-todo/SKILL.md`。

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
