# @xiaolinstar/ai-todo-mcp

stdio **MCP Server** for [ai-todo](https://github.com/xiaolinstar/ai-todo). Wraps `ai-todo --json` so MCP-capable hosts (Cursor, Claude Desktop, VS Code, etc.) can call reminders, calendar, and contacts without shell.

## Prerequisites

1. **CLI** (global): `npm install -g @xiaolinstar/ai-todo-cli`
2. **PAT**: `AI_TODO_TOKEN` + `AI_TODO_API_URL`, or `~/.ai-todo/settings.json`

## MCP host config

```json
{
  "mcpServers": {
    "ai-todo": {
      "command": "npx",
      "args": ["-y", "@xiaolinstar/ai-todo-mcp"],
      "env": {
        "AI_TODO_TOKEN": "aitodo_xxx",
        "AI_TODO_API_URL": "https://xingxiaolin.cn"
      }
    }
  }
}
```

After global install: `"command": "ai-todo-mcp"` with empty `args`.

Full setup: [docs/mcp-setup.md](https://github.com/xiaolinstar/ai-todo/blob/main/docs/mcp-setup.md)

## Tools (P0)

`whoami`, `today`, `reminder_find`, `reminder_create`, `reminder_create_sourced`, `reminder_list`, `reminder_list_by_source`, `reminder_update_by_source`, `reminder_complete_by_source`, `contact_search`, `calendar_today`, `calendar_create`
