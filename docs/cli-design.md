# ai-todo CLI 设计

日期：2026-05-19

## 设计目标

`ai-todo` CLI 同时服务两类用户：

- 人类用户：快速创建、查询和完成提醒事项
- AI Agent：通过稳定命令和 JSON 输出管理提醒、日程和联系人

CLI 不是完整 TUI，也不直接保存微信登录态。它通过独立 API Token 调用后端 API。

## 设计原则

- 默认输出适合人类阅读
- 所有查询和写操作都支持 `--json`
- 写操作支持幂等，适合 Agent 重试
- CLI 只提供结构化能力，不内置自然语言解析、意图识别或 LLM 调用
- 联系人能力通过搜索、详情和 ID 引用实现；重名确认由调用方 Agent 或用户完成
- 高风险操作需要显式参数或确认

## 全局参数

```bash
ai-todo <command> [options]
```

通用参数：

| 参数 | 说明 |
| --- | --- |
| `--json` | 输出 JSON |
| `--idempotency-key <key>` | 指定幂等键 |

连接与认证写入 `~/.ai-todo/settings.json`（`url` + `token`），见 `apps/cli/settings.example.json`。  
`ai-todo login --url … --token …` 负责首次配置；业务命令不再携带 `--api-url`。

## 登录与授权

### login

```bash
ai-todo login
```

MVP 可先支持粘贴 API Token：

```bash
ai-todo login --token aitodo_xxx
```

后续可支持浏览器或小程序扫码授权。

### whoami

```bash
ai-todo whoami
```

JSON 输出：

```json
{
  "ok": true,
  "user": {
    "id": "user_123",
    "display_name": "星星",
    "timezone": "Asia/Shanghai"
  }
}
```

### logout

```bash
ai-todo logout
```

只清理本地配置，不自动吊销服务端 token。吊销 token 应在小程序或控制台完成。

## Reminder 命令

### add

结构化创建提醒：

```bash
ai-todo reminder create \
  --title "给客户王总发报价确认邮件" \
  --due "2026-05-20 10:00" \
  --contact wangzong
```

人类输出：

```text
已创建提醒：给客户王总发报价确认邮件
时间：2026-05-20 10:00
联系人：王总
```

JSON 输出：

```json
{
  "ok": true,
  "operation": "create_reminder",
  "reminder": {
    "id": "rem_123",
    "title": "给客户王总发报价确认邮件",
    "status": "pending",
    "due_at": "2026-05-20T10:00:00+08:00",
    "contacts": [
      {
        "id": "contact_123",
        "handle": "wangzong",
        "display_name": "王总"
      }
    ]
  }
}
```

联系人不明确时：

```json
{
  "ok": false,
  "error": {
    "code": "CONTACT_AMBIGUOUS",
    "message": "Multiple contacts matched this name.",
    "candidates": [
      {
        "id": "contact_123",
        "display_name": "王总",
        "company": "示例科技"
      },
      {
        "id": "contact_456",
        "display_name": "王总",
        "company": "另一家公司"
      }
    ]
  }
}
```

Agent 应在这种情况下停止写操作，并向用户确认联系人。

### today

```bash
ai-todo today
```

聚合展示今日提醒和日程。

```bash
ai-todo today --json
```

JSON 输出：

```json
{
  "ok": true,
  "date": "2026-05-19",
  "timezone": "Asia/Shanghai",
  "reminders": [],
  "calendar_events": []
}
```

### list

```bash
ai-todo list --status pending
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `--status <status>` | `pending` / `completed` / `cancelled` |
| `--from <date>` | 起始日期 |
| `--to <date>` | 结束日期 |
| `--contact <id_or_handle>` | 按联系人筛选 |
| `--limit <n>` | 返回数量 |

### done

```bash
ai-todo done rem_123
```

JSON 输出：

```json
{
  "ok": true,
  "operation": "complete_reminder",
  "reminder": {
    "id": "rem_123",
    "status": "completed",
    "completed_at": "2026-05-19T12:00:00+08:00"
  }
}
```

### update

```bash
ai-todo update rem_123 --title "给客户发送最终报价"
```

### reschedule

```bash
ai-todo reschedule rem_123 "下周一上午"
```

也支持结构化时间：

```bash
ai-todo reschedule rem_123 --due "2026-05-25 10:00"
```

## Calendar 命令

### calendar today

```bash
ai-todo calendar today
```

### calendar list

```bash
ai-todo calendar list --date 2026-05-20
```

### calendar add

结构化：

```bash
ai-todo calendar add \
  --title "和 Alice 讨论项目计划" \
  --start "2026-05-20 14:00" \
  --end "2026-05-20 15:00" \
  --contact alice
```

JSON 输出：

```json
{
  "ok": true,
  "operation": "create_calendar_event",
  "calendar_event": {
    "id": "evt_123",
    "title": "和 Alice 讨论项目计划",
    "start_at": "2026-05-20T14:00:00+08:00",
    "end_at": "2026-05-20T15:00:00+08:00",
    "contacts": [
      {
        "id": "contact_456",
        "handle": "alice",
        "display_name": "Alice"
      }
    ]
  }
}
```

## Contacts 命令

通讯录是 AI 代理理解“发给谁、约谁、提醒谁”的基础能力。

### contact add

```bash
ai-todo contact add "王总" \
  --handle wangzong \
  --company "示例科技" \
  --title "采购负责人" \
  --email wang@example.com \
  --phone +8613812345678 \
  --alias "客户王总"
```

JSON 输出：

```json
{
  "ok": true,
  "operation": "create_contact",
  "contact": {
    "id": "contact_123",
    "handle": "wangzong",
    "display_name": "王总",
    "company": "示例科技",
    "methods": [
      {
        "type": "email",
        "value": "wang@example.com",
        "is_primary": true
      }
    ],
    "aliases": ["客户王总"]
  }
}
```

### contact list

```bash
ai-todo contact list
```

### contact search

```bash
ai-todo contact search "王总"
```

JSON 输出：

```json
{
  "ok": true,
  "contacts": [
    {
      "id": "contact_123",
      "display_name": "王总",
      "company": "示例科技",
      "primary_email": "wang@example.com"
    }
  ]
}
```

### contact show

```bash
ai-todo contact show contact_123
```

也可以使用当前用户通讯录内唯一的 `handle`：

```bash
ai-todo contact show wangzong
```

### contact update

```bash
ai-todo contact update wangzong --company "新公司"
```

### contact method add

```bash
ai-todo contact method add contact_123 --type email --value wang@example.com --label work
```

## 不提供自然语言命令

CLI 不提供 `parse`、`ask`、NLP 版 `contact resolve` 等命令。自然语言理解由 OpenClaw、Claude、Codex、Cursor 等调用方完成；调用方应在确认后调用结构化 CLI 命令或 HTTP API。

## Agent 使用约束

Agent 调用 CLI 时建议遵守：

- 查询优先使用 `--json`
- 写操作必须提供 `--idempotency-key`
- Agent 自行解析自然语言，并把结果转换为结构化字段
- 联系人不明确时，先调用 `contact search`，再请求用户选择联系人 ID 或 handle
- 缺少必要联系方式时不得假设
- 批量修改必须显式使用批量命令，MVP 暂不提供
- 邮件发送不在 MVP CLI 范围内

推荐 Agent 创建提醒：

```bash
ai-todo reminder create \
  --title "给客户王总发报价确认邮件" \
  --due "2026-05-20T10:00:00+08:00" \
  --contact wangzong \
  --json \
  --idempotency-key "uuid"
```

## 错误码

| 错误码 | 说明 |
| --- | --- |
| `UNAUTHORIZED` | 未登录或 token 无效 |
| `FORBIDDEN` | 权限不足 |
| `VALIDATION_ERROR` | 参数错误 |
| `NOT_FOUND` | 资源不存在 |
| `CONTACT_NOT_FOUND` | 联系人不存在 |
| `CONTACT_METHOD_REQUIRED` | 缺少所需联系方式 |
| `CONFIRMATION_REQUIRED` | 需要用户确认 |
| `IDEMPOTENCY_CONFLICT` | 幂等键冲突 |
| `NETWORK_ERROR` | 网络错误 |
| `SERVER_ERROR` | 服务端错误 |

## MVP 命令清单

第一阶段优先实现：

```bash
ai-todo login
ai-todo whoami
ai-todo add
ai-todo today
ai-todo list
ai-todo done
ai-todo reschedule
ai-todo calendar today
ai-todo calendar add
ai-todo contact add
ai-todo contact search
ai-todo contact show
```

暂缓：

- `ai-todo email send`
- `ai-todo inbox`
- 批量改期
- 自动排期
- 撤销复杂操作
- 第三方日历同步
- 自然语言解析命令不在路线图
