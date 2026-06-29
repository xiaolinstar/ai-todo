# ai-todo MCP Server 配置

`@xiaolinstar/ai-todo-mcp` 提供 **stdio MCP Server**，通过子进程调用 `ai-todo --json`，与 CLI 共用鉴权与 API 契约。

## CLI 与 MCP：何时用哪个

MCP **不是** CLI 的「更简单安装版」。两者共享 PAT 与 API，差别在 **Agent 怎么调用**，不在用户是否 `npm install`。

```text
         PAT + API URL（一次配置，两者相同）
                    │
           ┌────────┴────────┐
           ▼                 ▼
      ai-todo CLI      ai-todo MCP Server
   （shell / 脚本）    （stdio JSON-RPC 工具协议）
           │                 │
           └────────┬────────┘
                    ▼
              同一套业务 API
```

| 维度             | CLI                                     | MCP                                                |
| ---------------- | --------------------------------------- | -------------------------------------------------- |
| **面向谁**       | 终端、脚本、CI、任意能跑 shell 的 Agent | 支持 **MCP 协议** 的 IDE / 桌面 Agent              |
| **模型怎么调**   | 拼 `ai-todo … --json` 命令              | 调具名 tool + JSON 参数（如 `reminder_find`）      |
| **能力范围**     | 全量子命令                              | v0.6.2 起 **12 个 P0 工具**（常用 Agent 场景子集） |
| **用户额外配置** | 通常无（PATH + settings）               | 宿主里注册 MCP server（见下文）                    |
| **价值**         | 通用、完整、随处可用                    | 零 shell、参数 schema 校验、宿主原生工具面板       |

**选 MCP**：宿主已支持 MCP（见下节），希望模型少碰 shell、工具面固定、参数结构化。  
**选 CLI**：终端 / cron / 无 MCP 的 Agent（OpenClaw、Claude Code、自建 bot）、需要完整子命令或 MCP 未覆盖的能力。  
**两者可并存**：CLI 是执行层真源；MCP 是协议适配层，内部仍 `spawn ai-todo --json`。

> 终端用户用 `npx -y @xiaolinstar/ai-todo-mcp` 即可，无需 clone 仓库。仓库内开发见「仓库贡献者」。

## 适用宿主（不限于 Cursor）

凡支持 **stdio MCP**、可配置 `mcpServers` 的环境均可使用，例如：

| 宿主                                         | 配置文件（示例路径）                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| **Cursor**                                   | 项目 `.cursor/mcp.json` 或用户 MCP 设置                                    |
| **Claude Desktop**                           | `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS） |
| **VS Code**（MCP 扩展 / Copilot agent 模式） | 用户或工作区 MCP 配置（随扩展文档）                                        |
| **Windsurf / Cline / Continue** 等           | 各产品 MCP 设置页或 `mcp.json`                                             |
| **其他 MCP 客户端**                          | 统一字段：`command` + `args` + `env`                                       |

下文配置 JSON **各宿主通用**；仅文件路径与入口不同。把同一段 `mcpServers.ai-todo` 复制到对应配置即可。

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

## 安装 MCP

### 终端用户（推荐）

```bash
npm install -g @xiaolinstar/ai-todo-cli   # MCP 子进程依赖 CLI
npm install -g @xiaolinstar/ai-todo-mcp    # 可选；或用 npx 免全局安装
```

宿主配置示例（各宿主通用，**推荐 npx**）：

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

全局安装 MCP 后可将 `command` 改为 `ai-todo-mcp`、`args` 留空。

### 仓库贡献者

```bash
pnpm install
pnpm mcp:build
pnpm mcp:smoke
```

将 `command` / `args` 指向构建产物：

```json
"command": "node",
"args": ["/ABS/PATH/ai-todo/packages/mcp/dist/index.js"]
```

## 宿主配置（通用模板）

在对应宿主的 MCP 配置中加入（**Cursor、Claude Desktop、VS Code MCP 等结构相同**）：

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

**CLI 路径**（仅当 `ai-todo` 不在 PATH 时）：

```json
"env": {
  "AI_TODO_TOKEN": "aitodo_xxx",
  "AI_TODO_API_URL": "https://xingxiaolin.cn",
  "AI_TODO_CLI_PATH": "/usr/local/bin/ai-todo"
}
```

仓库内开发可指向 CLI 构建产物（`.js` 时由 MCP 用 `node` 执行）：

```json
"AI_TODO_CLI_PATH": "/ABS/PATH/ai-todo/apps/cli/dist/index.js"
```

### 各宿主入口

| 宿主               | 操作                                              |
| ------------------ | ------------------------------------------------- |
| **Cursor**         | 设置 → MCP → 编辑配置，或项目 `.cursor/mcp.json`  |
| **Claude Desktop** | 编辑 `claude_desktop_config.json`，重启应用       |
| **VS Code / 其他** | 按该产品 MCP 文档添加 server；JSON 字段与上表相同 |

配置后重启宿主或重载 MCP，在工具列表中应看到 `whoami`、`today`、`reminder_find` 等。

## 可用工具（P0）

| MCP tool                      | 说明                             |
| ----------------------------- | -------------------------------- |
| `whoami`                      | 当前用户与时区                   |
| `today`                       | 今日提醒与日程                   |
| `reminder_find`               | 按 `source` + `external_id` 反查 |
| `reminder_create`             | 创建提醒                         |
| `reminder_create_sourced`     | 带来源键创建（幂等）             |
| `reminder_list`               | 列表                             |
| `reminder_list_by_source`     | 按来源列表                       |
| `reminder_update_by_source`   | 按来源更新                       |
| `reminder_complete_by_source` | 按来源完成                       |
| `contact_search`              | 搜索联系人                       |
| `calendar_today`              | 今日日程                         |
| `calendar_create`             | 创建日程                         |

完整 CLI 能力见 [agent-usage.md](./agent-usage.md)；工具目录真源见 `packages/agent-protocol/dist/agent-tools.json`。

## 故障排查

| 现象                         | 处理                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| 提示缺少 token               | 配置 `AI_TODO_TOKEN` 或 `~/.ai-todo/settings.json`             |
| `ai-todo: command not found` | 设置 `AI_TODO_CLI_PATH` 或 `npm i -g @xiaolinstar/ai-todo-cli` |
| `ok: false` / 401            | PAT 无效或已吊销，在小程序重新创建                             |
| MCP 无响应                   | 确认使用 **stdio** 启动，勿在终端直接交互运行                  |

## npm 发布（维护者）

与 CLI 相同，在 **`packages/mcp`** 目录发布 scope 包 `@xiaolinstar/ai-todo-mcp`（esbuild 已将依赖打入 `dist/index.js`）。

```bash
# 1. 登录 npm（账号需能发布 @xiaolinstar scope，首次可用浏览器 OTP）
npm login --registry https://registry.npmjs.org
npm whoami

# 2. 构建并冒烟（prepublishOnly 也会执行）
cd packages/mcp
pnpm build
pnpm smoke

# 3. 预览将上传的文件
npm pack --dry-run

# 4. 发布（已首发 0.1.0）
npm publish --access public --registry https://registry.npmjs.org

# 后续版本：先 bump packages/mcp/package.json 的 version，再 publish
```

CLI 发布：

```bash
cd apps/cli
pnpm build
npm publish --access public --registry https://registry.npmjs.org
```

当前 npm：`@xiaolinstar/ai-todo-mcp@0.1.0`、`@xiaolinstar/ai-todo-cli@0.5.1`（2026-06-09 验证）。

## 相关文档

- [agent-usage.md](./agent-usage.md) — CLI 工作流与 MCP 选型
- [skills/ai-todo/SKILL.md](../skills/ai-todo/SKILL.md) — 无 MCP 时的 Agent Skill
- [releases/v0.6.2-plan.md](./releases/v0.6.2-plan.md)
- [releases/v0.6.2.1.md](./releases/v0.6.2.1.md) — npm 首发说明
