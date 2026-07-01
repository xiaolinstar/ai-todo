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

| 参数                      | 说明       |
| ------------------------- | ---------- |
| `--json`                  | 输出 JSON  |
| `--idempotency-key <key>` | 指定幂等键 |

连接与认证写入 `~/.ai-todo/settings.json`（`url` + `token`），见 `apps/cli/settings.example.json`。  
**PAT 的创建、列表、吊销仅在微信小程序完成**；CLI 不提供 `ai-todo token` 子命令（v0.8.3+ 产品策略，见下文「PAT 生命周期」）。

## PAT 生命周期与 CLI 边界（v0.8.3+）

| 能力             | 入口                                      | 说明                                                  |
| ---------------- | ----------------------------------------- | ----------------------------------------------------- |
| **创建 PAT**     | 小程序 **我的 → Agent 令牌**              | 明文仅显示一次；复制后写入本机                        |
| **列出 PAT**     | 小程序 Agent 令牌页                       | 含状态、到期、最后使用、吊销入口                      |
| **吊销单个 PAT** | 小程序令牌详情页                          | 需微信登录身份                                        |
| **批量吊销**     | 小程序开发者选项（develop）或后续正式设置 | 应急清理                                              |
| **本机写入 PAT** | `ai-todo login --token`                   | 粘贴小程序复制的密钥，**不是**在 CLI 签发             |
| **本地开发签发** | `ai-todo login --issue-pat`               | 仅 `allow_dev_auth` 环境；生产用户不使用              |
| **本机清除配置** | `ai-todo logout`                          | 只删 `settings.json` 中的 token，**不**吊销服务端 PAT |

**不提供**（自 v0.8.3 起从 CLI 移除）：

```text
ai-todo token list
ai-todo token create
ai-todo token revoke
ai-todo token revoke-all
```

**理由**：

1. PAT 属于**管理员级**凭据，应在已微信认证的小程序 UI 中操作，避免终端 history、多通道行为不一致。
2. 小程序已覆盖完整生命周期 UI；CLI 重复 create/revoke 增加误操作与文档负担。
3. CLI 专注 **消费 PAT**（reminder / calendar / contact / Agent `--json`），不负责签发与吊销。

**推荐工作流（生产）**：

```text
小程序创建 PAT → 复制 aitodo_xxx → ai-todo login --token aitodo_xxx
                → ai-todo whoami / ai-todo today
需要吊销时     → 回到小程序 Agent 令牌页操作（非 CLI）
```

## 登录与授权

### login

```bash
ai-todo login
ai-todo login --token aitodo_xxx
ai-todo login --url https://xingxiaolin.cn --token aitodo_xxx
```

将小程序签发的 PAT 写入 `~/.ai-todo/settings.json`。无 `--token` 时仅保存/检查 API URL，并提示去小程序创建令牌。

**本地开发**（API `AI_TODO_ALLOW_DEV_AUTH=true`）可一键签发并写入本机：

```bash
ai-todo login --issue-pat [--name "CLI Local"]
```

`--issue-pat` **不**面向生产用户；生产环境应使用小程序创建 PAT。

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

### profile update

更新当前 CLI Token 对应用户的个人资料：

```bash
ai-todo profile update --name xiaolinstar
ai-todo profile update --name xiaolinstar --avatar-url "wxfile://avatar"
```

该命令调用 `PATCH /v1/me/profile`，适合调试或 Agent 维护账户展示名。CLI 必须使用该用户自己的 PAT；微信小程序会话 Token 不用于 CLI。

### logout

```bash
ai-todo logout
```

只清理本地配置，不自动吊销服务端 token。吊销 PAT 请在微信小程序 **我的 → Agent 令牌** 操作。

## Reminder 命令

### add

结构化创建提醒：

```bash
ai-todo reminder create \
  --title "给客户王总发报价确认邮件" \
  --due "2026-05-20 10:00" \
  --tag "客户" \
  --tag "报价" \
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

| 参数                       | 说明                                  |
| -------------------------- | ------------------------------------- |
| `--status <status>`        | `pending` / `completed` / `cancelled` |
| `--q <query>`              | 全文搜索（title、notes、tag、跟踪）   |
| `--tag <name>`             | 按 tag 精确筛选                       |
| `--from <date>`            | 起始日期                              |
| `--to <date>`              | 结束日期                              |
| `--contact <id_or_handle>` | 按联系人筛选                          |
| `--limit <n>`              | 返回数量                              |

### track add

追加事项跟踪条目（服务端自动填充 `MM-DD` 日期前缀）：

```bash
ai-todo reminder track add rem_123 已联系客户
```

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

### contact delete

```bash
ai-todo contact delete contact_123
ai-todo contact delete wangzong
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

与 [api-design.md](./api-design.md) §错误码 一致（ADR-0005 前缀码）。CLI / `--json` 输出中的 `error.code` 与 API wire 相同。

| 前缀     | 常见 code                  | 说明                        |
| -------- | -------------------------- | --------------------------- |
| AUTH     | `AUTH_INVALID_TOKEN`       | 未登录或 token 无效         |
| AUTH     | `AUTH_FORBIDDEN`           | 权限不足                    |
| VAL      | `VAL_INVALID_INPUT`        | 参数错误                    |
| BIZ      | `BIZ_NOT_FOUND`            | 资源不存在                  |
| BIZ      | `BIZ_CONTACT_NOT_FOUND`    | 联系人不存在                |
| BIZ      | `BIZ_IDEMPOTENCY_CONFLICT` | 幂等键冲突                  |
| CLI 本地 | `NETWORK_ERROR`            | 网络错误（非 API 返回）     |
| CLI 本地 | `SERVER_ERROR`             | 服务端不可达（非 API 返回） |

完整列表与 legacy alias 见 `api-design.md`。

## MVP 命令清单

第一阶段优先实现：

```bash
ai-todo login
ai-todo whoami
ai-todo profile update
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
ai-todo contact delete
```

暂缓：

- `ai-todo email send`
- `ai-todo inbox`
- 批量改期
- 自动排期
- 撤销复杂操作
- 第三方日历同步
- 自然语言解析命令不在路线图
