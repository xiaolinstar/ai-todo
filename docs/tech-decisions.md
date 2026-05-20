# ai-todo 技术决策

日期：2026-05-20

## 已确认

### 微信小程序

- **技术栈：微信原生**（不使用 Taro / uni-app）
- MVP 页面：登录占位、今日、创建提醒、完成、联系人查询与选择

### 认证与用户

- **MVP：固定开发用户**，不实现微信登录与 CLI Token
- 默认用户 ID：`user_dev`（可通过 `AI_TODO_DEV_USER_ID` 配置）
- 所有业务数据按 `user_id` 隔离；后续再接入 `POST /v1/auth/wechat/login` 与 Bearer Token
- 当前请求无需 `Authorization` 头，服务端自动解析为开发用户

### 后端

- Python + FastAPI + PostgreSQL + Alembic
- 本地开发用户由应用启动时 `ensure_dev_user` 与迁移种子共同保证存在
- **Calendar MVP 已实现**：`calendar_events` 表与 `/v1/calendar/*`；`/v1/today` 聚合返回日程

## 待后续决定

- CLI Token 创建入口（小程序 vs 独立控制台）
- 自然语言解析模型与部署方式
- MCP Server 是否作为独立包发布
