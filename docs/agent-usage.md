# Agent 使用指南（CLI + Skills）

ai-todo **不提供**服务端自然语言解析。Agent（OpenClaw、Claude Code、Cursor 等）在本地理解用户意图后，调用 **结构化 CLI** 或 HTTP API。

## 前置条件

```bash
# 构建 CLI
pnpm install
pnpm build

# 启动 API（另开终端）
pnpm dev:api

# 配置 CLI 默认地址（可选）
ai-todo login --api-url http://127.0.0.1:3100
# 或 export AI_TODO_API_URL=http://127.0.0.1:3100
```

全局建议：**所有 Agent 调用加 `--json`**，解析 `ok` / `data` / `error.code`。

## 推荐工作流

### 1. 查看今天

```bash
ai-todo today --json
```

### 2. 用户说「明天十点提醒我给王总发邮件」

Agent 自行解析时间与标题，**不要**调用不存在的 `parse` 命令：

```bash
# 先搜联系人（重名则向用户确认 contact_id）
ai-todo contact search "王总" --json

# 再创建提醒
ai-todo reminder create \
  --title "给客户王总发报价确认邮件" \
  --due "2026-05-21T10:00:00+08:00" \
  --json
```

### 3. 安排会议

```bash
ai-todo calendar add \
  --title "产品评审" \
  --start "2026-05-20T14:00:00+08:00" \
  --end "2026-05-20T15:00:00+08:00" \
  --location "会议室 A" \
  --json
```

### 4. 完成 / 改期 / 删除

```bash
ai-todo reminder done rem_xxx --json
ai-todo reminder reschedule rem_xxx --due "2026-05-22T09:00:00+08:00" --json
ai-todo reminder delete rem_xxx --json
```

## 命令索引

| 意图 | 命令 |
|------|------|
| 当前用户 | `ai-todo whoami --json` |
| 今日聚合 | `ai-todo today --json` |
| 创建提醒 | `ai-todo reminder create --title … [--due …]` |
| 提醒列表 | `ai-todo reminder list [--status pending]` |
| 完成提醒 | `ai-todo reminder done <id>` |
| 创建日程 | `ai-todo calendar add --title … --start …` |
| 今日日程 | `ai-todo calendar today --json` |
| 搜索联系人 | `ai-todo contact search "<q>"` |
| 创建联系人 | `ai-todo contact add "<name>" --email …` |

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

## HTTP API 备选

Agent 也可直接 `curl` / `fetch` 调用 `/v1/*`，契约见 `docs/api-design.md`。CLI 与 API 字段均使用 camelCase JSON。
