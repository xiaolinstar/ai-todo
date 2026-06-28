# Cursor 配置（派生自 dev-standards）

本目录下的文件**由标准库同步生成或覆盖**，请勿在本仓库直接手改后提交。

| 路径               | 真源                                                                                            | 同步命令                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `rules/*.mdc`      | `~/AgentProjects/dev-standards/adapters/cursor/`                                                | `~/AgentProjects/dev-standards/scripts/sync.sh adapters cursor .`              |
| `permissions.json` | `~/AgentProjects/dev-standards/permissions/manifest.json` + `permissions/overlays/ai-todo.json` | `~/AgentProjects/dev-standards/scripts/sync.sh permissions --user --project .` |

## 修改 check / deny 规则

1. 改 **全局**规则 → `dev-standards/permissions/manifest.json`
2. 改 **本项目**特例 → `dev-standards/permissions/overlays/ai-todo.json`
3. 在 ai-todo 根目录执行：

```bash
~/AgentProjects/dev-standards/scripts/sync.sh permissions --user --project .
```

4. 将 `permissions/overlays/ai-todo.json` 的变更在 **dev-standards** 仓库 commit；将同步后的 `.cursor/permissions.json`（及必要时 `.codex/rules/`）在 **ai-todo** commit。

**不要**直接编辑 `.cursor/permissions.json`——下次 sync 会覆盖，且与 manifest 生命周期脱节。

操作说明见 dev-standards Skill `agent-permissions` 与 [playbook/agent-config.md](../../dev-standards/playbook/agent-config.md)。
