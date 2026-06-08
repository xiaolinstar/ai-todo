# ai-todo MCP Server 配置

`@ai-todo/mcp` 提供 **stdio MCP Server**，通过子进程调用 `ai-todo --json`，与 CLI 共用鉴权与 API 契约。

## 前置条件

1. 已安装 **ai-todo CLI**（全局或仓库内构建）：

   ```bash
   npm install -g @xiaolinstar/ai-todo-cli
   # 或仓库内：pnpm --filter @xiaolinstar/ai-todo-cli build
   ```

2. 已配置 **PAT**（二选一）：

   ```bash
   # 推荐：环境变量
   export AI_TODO_TOKEN=aitodo_xxx
   export AI_TODO_API_URL=https://xingxiaolin.cn

   # 或 ~/.ai-todo/settings.json
   ```

   PAT 在微信小程序：**我的 → CLI / Agent 访问令牌 → 创建**。

## 构建 MCP（仓库内）

```bash
pnpm install
pnpm --filter @ai-todo/agent-protocol build   # 可选，生成 agent-tools.json
pnpm mcp:build
pnpm mcp:smoke
```

## Cursor 配置

在项目或用户 MCP 配置中加入（路径按本机仓库位置修改）：

```json
{
  "mcpServers": {
    "ai-todo": {
      "command": "node",
      "args": ["/ABS/PATH/ai-todo/packages/mcp/dist/index.js"],
      "env": {
        "AI_TODO_TOKEN": "aitodo_xxx",
        "AI_TODO_API_URL": "https://xingxiaolin.cn"
      }
    }
  }
}
```

若已全局安装 CLI，可省略 `AI_TODO_CLI_PATH`；否则可指定：

```json
"env": {
  "AI_TODO_CLI_PATH": "/usr/local/bin/ai-todo"
}
```

仓库内开发可指向构建产物：

```json
"AI_TODO_CLI_PATH": "/ABS/PATH/ai-todo/apps/cli/dist/index.js"
```

（`AI_TODO_CLI_PATH` 为 `.js` 时用 `node` 执行。）

## Claude Desktop 配置

编辑 `claude_desktop_config.json`（macOS 示例路径 `~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "ai-todo": {
      "command": "node",
      "args": ["/ABS/PATH/ai-todo/packages/mcp/dist/index.js"],
      "env": {
        "AI_TODO_TOKEN": "aitodo_xxx",
        "AI_TODO_API_URL": "https://xingxiaolin.cn"
      }
    }
  }
}
```

## 可用工具（P0）

| MCP tool | 说明 |
|----------|------|
| `whoami` | 当前用户与时区 |
| `today` | 今日提醒与日程 |
| `reminder_find` | 按 `source` + `external_id` 反查 |
| `reminder_create` | 创建提醒 |
| `reminder_create_sourced` | 带来源键创建（幂等） |
| `reminder_list` | 列表 |
| `reminder_list_by_source` | 按来源列表 |
| `reminder_update_by_source` | 按来源更新 |
| `reminder_complete_by_source` | 按来源完成 |
| `contact_search` | 搜索联系人 |
| `calendar_today` | 今日日程 |
| `calendar_create` | 创建日程 |

完整 CLI 能力见 [agent-usage.md](./agent-usage.md)；工具目录真源见 `packages/agent-protocol/dist/agent-tools.json`。

## 故障排查

| 现象 | 处理 |
|------|------|
| 提示缺少 token | 配置 `AI_TODO_TOKEN` 或 `~/.ai-todo/settings.json` |
| `ai-todo: command not found` | 设置 `AI_TODO_CLI_PATH` 或 `npm i -g @xiaolinstar/ai-todo-cli` |
| `ok: false` / 401 | PAT 无效或已吊销，在小程序重新创建 |
| MCP 无响应 | 确认使用 **stdio** 启动，勿在终端直接交互运行 |

## 相关文档

- [agent-usage.md](./agent-usage.md)
- [releases/v0.6.2-plan.md](./releases/v0.6.2-plan.md)
