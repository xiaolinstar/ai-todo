# ai-todo API 设计

日期：2026-05-19

## 设计目标

后端 API 是微信小程序、CLI、未来原生 App 和 AI Agent 的统一能力层。

MVP API 需要覆盖：

- 微信小程序登录
- CLI Token 授权
- 提醒事项创建、查询、完成、改期
- 简单日程创建和查询
- 联系人创建、查询、联系方式管理
- Agent 写操作审计和幂等

> **范围说明（2026-05-20）**：不实现服务端自然语言解析（`POST /v1/nl/parse` 等）。
> 自然语言由 OpenClaw / Claude 等 Agent + CLI/Skills 承担，见 `docs/tech-decisions.md`。

## API 风格

第一版建议使用 REST + JSON。

原因：

- CLI 调用简单
- 小程序接入直接
- Agent 工具协议容易包装
- 后续可以在内部服务层复用同一套 schema

统一前缀：

```text
/v1
```

统一响应：

```json
{
  "ok": true,
  "data": {},
  "request_id": "req_123"
}
```

错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "CONTACT_AMBIGUOUS",
    "message": "Multiple contacts matched this name.",
    "details": {}
  },
  "request_id": "req_123"
}
```

## 认证方式

### 小程序认证

```http
POST /v1/auth/wechat/login
```

请求：

```json
{
  "code": "wechat_login_code"
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "access_token": "session_token",
    "user": {
      "id": "user_123",
      "display_name": "星星",
      "timezone": "Asia/Shanghai"
    }
  }
}
```

### CLI Token 认证

CLI 使用 Bearer Token：

```http
Authorization: Bearer aitodo_xxx
```

服务端只保存 token hash。所有 CLI / Agent 写操作应写入 `CommandLog`。

## 通用请求头

写操作建议支持：

```http
Idempotency-Key: uuid
X-Client-Source: cli
```

`X-Client-Source` 可选值：

- `miniapp`
- `cli`
- `agent`
- `api`

## 用户接口

### 获取当前用户

```http
GET /v1/me
```

响应：

```json
{
  "ok": true,
  "data": {
    "id": "user_123",
    "display_name": "星星",
    "timezone": "Asia/Shanghai"
  }
}
```

## CLI Token 接口

### 创建 CLI Token

```http
POST /v1/api-tokens
```

请求：

```json
{
  "name": "MacBook Codex",
  "scopes": ["read", "write", "contact:read"],
  "expires_at": "2026-08-19T00:00:00+08:00"
}
```

响应只返回一次明文 token：

```json
{
  "ok": true,
  "data": {
    "id": "token_123",
    "token": "aitodo_xxx",
    "name": "MacBook Codex",
    "scopes": ["read", "write", "contact:read"]
  }
}
```

### 列出 CLI Token

```http
GET /v1/api-tokens
```

### 吊销 CLI Token

```http
DELETE /v1/api-tokens/{token_id}
```

## Reminder 接口

### 创建提醒

```http
POST /v1/reminders
```

请求：

```json
{
  "title": "给客户王总发报价确认邮件",
  "notes": "确认最终报价和交付时间",
  "due_at": "2026-05-20T10:00:00+08:00",
  "remind_at": "2026-05-20T09:30:00+08:00",
  "contact_ids": ["contact_123"]
}
```

`contact_ids` 为兼容早期契约保留字段名；服务端会把每一项解析为当前用户通讯录内的 `Contact.id` 或 `Contact.handle`，并最终存储真实 `contact_id`。后续如升级大版本，可考虑改名为 `contact_refs`。

响应：

```json
{
  "ok": true,
  "data": {
    "id": "rem_123",
    "title": "给客户王总发报价确认邮件",
    "status": "pending",
    "due_at": "2026-05-20T10:00:00+08:00",
    "contacts": [
      {
        "id": "contact_123",
        "display_name": "王总"
      }
    ]
  }
}
```

### 查询提醒列表

```http
GET /v1/reminders?status=pending&from=2026-05-19&to=2026-05-20
```

常用筛选：

- `status`
- `from`
- `to`
- `contact_id` / `contact_handle`
- `limit`
- `cursor`

### 查询今日提醒

```http
GET /v1/reminders/today
```

### 完成提醒

```http
POST /v1/reminders/{reminder_id}/complete
```

请求：

```json
{
  "completed_at": "2026-05-19T12:00:00+08:00"
}
```

### 改期提醒

```http
POST /v1/reminders/{reminder_id}/reschedule
```

请求：

```json
{
  "due_at": "2026-05-21T10:00:00+08:00",
  "remind_at": "2026-05-21T09:30:00+08:00"
}
```

### 更新提醒

```http
PATCH /v1/reminders/{reminder_id}
```

### 删除提醒

```http
DELETE /v1/reminders/{reminder_id}
```

MVP 使用软删除。

## Calendar 接口

### 创建日程

```http
POST /v1/calendar/events
```

请求：

```json
{
  "title": "和 Alice 讨论项目计划",
  "start_at": "2026-05-20T14:00:00+08:00",
  "end_at": "2026-05-20T15:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "location": "线上会议",
  "contact_ids": ["contact_456"]
}
```

`contact_ids` 中的值可传 `Contact.id` 或当前用户通讯录内唯一的 `Contact.handle`。

### 查询日程

```http
GET /v1/calendar/events?from=2026-05-20T00:00:00+08:00&to=2026-05-21T00:00:00+08:00
```

### 查询今日日程

```http
GET /v1/calendar/today
```

### 更新日程

```http
PATCH /v1/calendar/events/{event_id}
```

### 删除日程

```http
DELETE /v1/calendar/events/{event_id}
```

MVP 不实现邀请流、会议室预订、重复日程和第三方日历同步。

## Contacts 接口

### 创建联系人

```http
POST /v1/contacts
```

请求：

```json
{
  "display_name": "王总",
  "company": "示例科技",
  "title": "采购负责人",
  "nickname": "老王",
  "methods": [
    {
      "type": "email",
      "label": "work",
      "value": "wang@example.com",
      "is_primary": true
    },
    {
      "type": "phone",
      "label": "mobile",
      "value": "+8613812345678",
      "is_primary": true
    }
  ],
  "aliases": ["王总", "客户王总"]
}
```

### 查询联系人列表

```http
GET /v1/contacts?q=王总&limit=20
```

响应：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "contact_123",
        "display_name": "王总",
        "company": "示例科技",
        "title": "采购负责人",
        "primary_email": "wang@example.com",
        "primary_phone": "+8613812345678"
      }
    ]
  }
}
```

### 获取联系人详情

```http
GET /v1/contacts/{contact_id}
```

`{contact_id}` 也可传当前用户通讯录内唯一的 `handle`。

### 更新联系人

```http
PATCH /v1/contacts/{contact_id}
```

`{contact_id}` 也可传当前用户通讯录内唯一的 `handle`。

### 删除联系人

```http
DELETE /v1/contacts/{contact_id}
```

### 添加联系方式

```http
POST /v1/contacts/{contact_id}/methods
```

### 更新联系方式

```http
PATCH /v1/contacts/{contact_id}/methods/{method_id}
```

### 删除联系方式

```http
DELETE /v1/contacts/{contact_id}/methods/{method_id}
```

## 不提供自然语言接口

API 不提供 `POST /v1/nl/parse` 或 NLP 版 `POST /v1/contacts/resolve`。调用方 Agent 负责自然语言理解、时间解析、联系人语义消歧和用户确认；本 API 只接收结构化字段并提供联系人搜索、详情查询、CRUD、幂等、审计和权限控制。

## Today 聚合接口

为了小程序首页和 CLI `today`，提供聚合接口：

```http
GET /v1/today
```

响应：

```json
{
  "ok": true,
  "data": {
    "date": "2026-05-19",
    "timezone": "Asia/Shanghai",
    "reminders": [],
    "calendar_events": []
  }
}
```

## 错误码

| 错误码 | 说明 |
| --- | --- |
| `UNAUTHORIZED` | 未登录或 token 无效 |
| `FORBIDDEN` | 权限不足 |
| `VALIDATION_ERROR` | 请求参数错误 |
| `NOT_FOUND` | 资源不存在 |
| `IDEMPOTENCY_CONFLICT` | 幂等键冲突 |
| `CONTACT_NOT_FOUND` | 联系人不存在 |
| `CONTACT_METHOD_REQUIRED` | 缺少所需联系方式 |
| `CONFIRMATION_REQUIRED` | 需要用户确认 |
| `RATE_LIMITED` | 请求过于频繁 |

## MVP 不做

- 完整邮件发送
- 邮件收件箱管理
- 复杂重复日程
- 会议室预订
- 组织通讯录
- 多人协作权限
- 自动批量排期
- 自然语言解析 / 内置 LLM / Prompt 编排
