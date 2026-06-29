# ai-todo 数据模型设计

日期：2026-05-19

## 设计目标

MVP 的核心模型围绕 `Reminder`、`CalendarEvent` 和 `Contact` 展开。

`Reminder` 管“要记得完成的事”，`CalendarEvent` 管“某个时间的安排”，`Contact` 管“某个人是谁以及怎么联系”。三者共同服务于微信小程序、CLI 和 AI Agent。

第一版数据模型应满足：

- 支持个人用户数据隔离
- 支持微信小程序登录和 CLI Token
- 支持提醒事项、简单日程和个人通讯录
- 支持外部 Agent 解析后的结构化落库
- 支持 Agent 写操作审计
- 为未来邮件发送、参与人和自动规划预留关联点

## 命名约定

- 产品和 CLI：`ai-todo`
- 用户可见的轻量事项：待办 / 提醒事项
- 后端核心对象：`Reminder`
- 日历对象：`CalendarEvent`
- 通讯录对象：`Contact`
- 联系方式对象：`ContactMethod`

暂不引入完整 `Task` 模型。

## 核心实体

### User

统一用户身份。业务数据必须通过 `user_id` 隔离，不直接依赖微信 `openid`。

`User.username` 是平台账号的公开短名，用于共享电子名片、用户主页、跨用户引用和未来协作能力。它属于平台身份，不属于某个用户的个人通讯录。

建议字段：

| 字段           | 类型      | 说明                           |
| -------------- | --------- | ------------------------------ |
| `id`           | string    | 用户 ID                        |
| `username`     | string?   | 平台级公开用户名，全局唯一     |
| `display_name` | string    | 用户展示名                     |
| `timezone`     | string    | 默认时区，例如 `Asia/Shanghai` |
| `locale`       | string    | 默认语言区域                   |
| `created_at`   | datetime  | 创建时间                       |
| `updated_at`   | datetime  | 更新时间                       |
| `deleted_at`   | datetime? | 软删除时间                     |

### Identity

登录身份绑定。MVP 先支持微信，后续可扩展 Apple、手机号、邮箱和 OAuth。

| 字段               | 类型      | 说明                                             |
| ------------------ | --------- | ------------------------------------------------ |
| `id`               | string    | 身份 ID                                          |
| `user_id`          | string    | 关联用户                                         |
| `provider`         | enum      | `wechat` / `apple` / `phone` / `email` / `oauth` |
| `provider_subject` | string    | 第三方用户标识，例如微信 openid                  |
| `union_id`         | string?   | 微信 unionid 或同类跨应用标识                    |
| `created_at`       | datetime  | 创建时间                                         |
| `last_used_at`     | datetime? | 最近使用时间                                     |

唯一约束：`provider + provider_subject`。

### ApiToken

CLI 和 Agent 调用 API 的授权凭证。服务端只保存 token 哈希，不保存明文。

| 字段           | 类型      | 说明                                 |
| -------------- | --------- | ------------------------------------ |
| `id`           | string    | Token ID                             |
| `user_id`      | string    | 归属用户                             |
| `name`         | string    | 设备或用途名称，例如 `MacBook Codex` |
| `token_hash`   | string    | Token 哈希                           |
| `scopes`       | string[]  | 权限范围                             |
| `expires_at`   | datetime? | 过期时间                             |
| `last_used_at` | datetime? | 最近使用时间                         |
| `revoked_at`   | datetime? | 吊销时间                             |
| `created_at`   | datetime  | 创建时间                             |

MVP 推荐作用域：

- `read`
- `write`
- `reminder:write`
- `calendar:write`
- `contact:read`
- `contact:write`
- `agent:plan`

### Reminder

提醒事项。强调事情本身和完成状态，不一定占用日历时间。

| 字段                  | 类型      | 说明                                                                                       |
| --------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `id`                  | string    | 提醒 ID                                                                                    |
| `user_id`             | string    | 归属用户                                                                                   |
| `title`               | string    | 标题                                                                                       |
| `notes`               | string?   | 备注                                                                                       |
| `status`              | enum      | `pending` / `in_progress` / `completed` / `cancelled`（产品 UI：未完成 / 处理中 / 已完成） |
| `due_at`              | datetime? | 截止时间                                                                                   |
| `remind_at`           | datetime? | 提醒触发时间                                                                               |
| `priority`            | enum?     | `low` / `normal` / `high`                                                                  |
| `source`              | enum      | `miniapp` / `cli` / `agent` / `api`                                                        |
| `created_by_token_id` | string?   | CLI / Agent Token 来源                                                                     |
| `created_at`          | datetime  | 创建时间                                                                                   |
| `updated_at`          | datetime  | 更新时间                                                                                   |
| `completed_at`        | datetime? | 完成时间                                                                                   |
| `deleted_at`          | datetime? | 软删除时间                                                                                 |

### CalendarEvent

日历事件。强调时间占用或明确时间安排。

| 字段                  | 类型      | 说明                                |
| --------------------- | --------- | ----------------------------------- |
| `id`                  | string    | 日程 ID                             |
| `user_id`             | string    | 归属用户                            |
| `title`               | string    | 标题                                |
| `description`         | string?   | 描述                                |
| `start_at`            | datetime  | 开始时间                            |
| `end_at`              | datetime? | 结束时间                            |
| `timezone`            | string    | 时区                                |
| `location`            | string?   | 地点                                |
| `reminder_id`         | string?   | 关联提醒事项                        |
| `source`              | enum      | `miniapp` / `cli` / `agent` / `api` |
| `created_by_token_id` | string?   | CLI / Agent Token 来源              |
| `created_at`          | datetime  | 创建时间                            |
| `updated_at`          | datetime  | 更新时间                            |
| `deleted_at`          | datetime? | 软删除时间                          |

MVP 不实现重复日程、会议室、复杂参与人和跨日程冲突检测。

### Contact

个人联系人。用于联系人搜索、结构化引用，以及未来邮件发送和日程参与人。

| 字段             | 类型      | 说明                                                                          |
| ---------------- | --------- | ----------------------------------------------------------------------------- |
| `id`             | string    | 联系人 ID                                                                     |
| `user_id`        | string    | 归属用户                                                                      |
| `handle`         | string    | 当前用户通讯录内的本地唯一短标识，用于 CLI / Agent / MCP / URL 参数引用联系人 |
| `linked_user_id` | string?   | 如果联系人已关联平台用户，则指向 `User.id`                                    |
| `handle_source`  | enum?     | `manual` / `generated` / `linked_username`                                    |
| `display_name`   | string    | 展示名                                                                        |
| `given_name`     | string?   | 名                                                                            |
| `family_name`    | string?   | 姓                                                                            |
| `nickname`       | string?   | 昵称                                                                          |
| `company`        | string?   | 公司                                                                          |
| `title`          | string?   | 职位                                                                          |
| `notes`          | string?   | 备注                                                                          |
| `source`         | enum      | `manual` / `imported` / `agent` / `api`                                       |
| `created_at`     | datetime  | 创建时间                                                                      |
| `updated_at`     | datetime  | 更新时间                                                                      |
| `deleted_at`     | datetime? | 软删除时间                                                                    |

MVP 中 `Contact` 是个人通讯录对象，不做企业组织架构。

`Contact.handle` 属于当前用户的个人通讯录视角，不等同于对方的平台账号名。它可以由展示名转写生成，也可以由用户手动修改。如果联系人关联了平台用户，默认可以使用对方 `User.username` 作为 `handle`，但用户仍可改成自己的本地称呼。

约束建议：

- `User.username` 全局唯一
- `Contact.user_id + Contact.handle` 唯一
- `Contact.handle` 可作为 CLI 的联系人引用参数，例如 `--contact xiaolin`
- 提醒和日程写接口的 `contact_ids` 当前兼容接收 `Contact.id` 或 `Contact.handle`，服务端解析后只落库真实 `contact_id`
- `Contact.linked_user_id` 只表达“这个通讯录条目关联了哪个平台用户”，不强制 `handle` 与 `username` 永久一致

生成规则建议：

- 中文姓名默认转为全拼，例如 `邢小林` → `xingxiaolin`
- 同一用户通讯录内重复时追加两位序号，例如 `xingxiaolin01`、`xingxiaolin02`
- 英文、数字和连字符可保留并规范为小写
- 用户手动设置的 `handle` 优先级最高

### ContactMethod

联系人方式。一个联系人可以有多个邮箱、手机号或其他渠道。

| 字段               | 类型      | 说明                                   |
| ------------------ | --------- | -------------------------------------- |
| `id`               | string    | 联系方式 ID                            |
| `user_id`          | string    | 冗余用户 ID，方便隔离查询              |
| `contact_id`       | string    | 关联联系人                             |
| `type`             | enum      | `email` / `phone` / `wechat` / `other` |
| `label`            | string?   | `work` / `home` / `personal` 等        |
| `value`            | string    | 联系方式值                             |
| `normalized_value` | string    | 归一化值                               |
| `is_primary`       | boolean   | 是否默认联系方式                       |
| `verified_at`      | datetime? | 验证时间                               |
| `created_at`       | datetime  | 创建时间                               |
| `updated_at`       | datetime  | 更新时间                               |

建议唯一约束：`user_id + type + normalized_value`，避免同一用户重复录入同一个邮箱或手机号。

### ContactAlias

联系人别名。用于结构化搜索、展示和人工/Agent 确认，不用于服务端 LLM 语义消歧。

| 字段               | 类型     | 说明                       |
| ------------------ | -------- | -------------------------- |
| `id`               | string   | 别名 ID                    |
| `user_id`          | string   | 归属用户                   |
| `contact_id`       | string   | 关联联系人                 |
| `alias`            | string   | 别名，例如 `王总`、`Alice` |
| `normalized_alias` | string   | 归一化别名                 |
| `created_at`       | datetime | 创建时间                   |

建议唯一约束：`user_id + normalized_alias + contact_id`。

### ReminderContact

提醒事项和联系人的关联关系。用于“提醒我给张三发方案”这类场景。

| 字段          | 类型     | 说明                               |
| ------------- | -------- | ---------------------------------- |
| `id`          | string   | 关联 ID                            |
| `reminder_id` | string   | 提醒 ID                            |
| `contact_id`  | string   | 联系人 ID                          |
| `role`        | enum     | `related` / `recipient` / `caller` |
| `created_at`  | datetime | 创建时间                           |

### CalendarEventContact

日程和联系人的关联关系。MVP 中作为轻量参与人记录，不实现邀请流。

| 字段                | 类型     | 说明                                    |
| ------------------- | -------- | --------------------------------------- |
| `id`                | string   | 关联 ID                                 |
| `calendar_event_id` | string   | 日程 ID                                 |
| `contact_id`        | string   | 联系人 ID                               |
| `role`              | enum     | `participant` / `organizer` / `related` |
| `created_at`        | datetime | 创建时间                                |

### Tag

轻量标签。第一版可选，如果实现成本高，可以先延后。

| 字段         | 类型     | 说明     |
| ------------ | -------- | -------- |
| `id`         | string   | 标签 ID  |
| `user_id`    | string   | 归属用户 |
| `name`       | string   | 标签名   |
| `color`      | string?  | 展示颜色 |
| `created_at` | datetime | 创建时间 |

### CommandLog

记录 CLI、Agent 和高风险 API 写操作，方便审计和撤销。

| 字段              | 类型     | 说明                                |
| ----------------- | -------- | ----------------------------------- |
| `id`              | string   | 日志 ID                             |
| `user_id`         | string   | 用户 ID                             |
| `api_token_id`    | string?  | Token 来源                          |
| `source`          | enum     | `cli` / `agent` / `miniapp` / `api` |
| `operation`       | string   | 操作名                              |
| `request_id`      | string?  | 请求 ID                             |
| `idempotency_key` | string?  | 幂等键                              |
| `target_type`     | string?  | 影响对象类型                        |
| `target_ids`      | string[] | 影响对象 ID                         |
| `input_summary`   | json     | 脱敏后的输入摘要                    |
| `result_summary`  | json     | 脱敏后的结果摘要                    |
| `created_at`      | datetime | 创建时间                            |

写接口应支持 `Idempotency-Key`，避免 Agent 重试造成重复创建。

## Agent 输入边界

本项目不保存、解析或执行大模型原始自然语言意图。外部 Agent 应先完成理解与确认，再把结构化字段写入本项目。

推荐写入形式：

```json
{
  "title": "给客户王总发报价确认邮件",
  "due_at": "2026-05-20T10:00:00+08:00",
  "contact_ids": ["wangzong"]
}
```

当联系人重名、缺少邮箱或用户表达不清时，Agent 应通过 `contact search` / `GET /v1/contacts?q=` 获取候选项，并向用户确认后再写入联系人 ID 或 handle。本项目只负责结构化校验、权限、审计、幂等和持久化。

## 未来扩展

### EmailMessage

未来邮件发送可单独引入：

- `EmailAccount`
- `EmailMessage`
- `EmailRecipient`
- `EmailAttachment`
- `CommunicationLog`

邮件发送会带来授权、风控、退信、附件、安全审计和撤回问题，不建议进入第一版 MVP。

### Task

如果未来需要项目型工作管理，可以在 `Reminder` 基础上扩展子项、清单和备注，仍不急于引入完整 `Task`。
