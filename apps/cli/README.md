# @xiaolinstar/ai-todo-cli

Structured command-line interface for [ai-todo](https://github.com/xiaolinstar/ai-todo) — reminders, calendar, contacts, and Agent-friendly `--json` output.

## Install

```bash
npm install -g @xiaolinstar/ai-todo-cli
```

The `ai-todo` command is available globally after install.

## Configure once

Create `~/.ai-todo/settings.json` (see `settings.example.json` in this package):

```json
{
  "url": "https://xingxiaolin.cn",
  "token": "aitodo_your_personal_access_token"
}
```

Get a Personal Access Token in the WeChat miniapp: **Mine → CLI / Agent access tokens → Create**, then either edit `settings.json` or run:

```bash
ai-todo login --token aitodo_xxx
```

PAT listing and revocation are **miniapp-only** (no `ai-todo token` subcommand as of v0.8.3). Local dev with `AI_TODO_ALLOW_DEV_AUTH=true` may use `ai-todo login --issue-pat`.

Environment variables override the file (useful for CI / agents):

```bash
export AI_TODO_TOKEN=aitodo_xxx
export AI_TODO_API_URL=https://xingxiaolin.cn
```

## Usage

```bash
ai-todo today
ai-todo reminder list --json
ai-todo whoami
ai-todo version
```

Run `ai-todo help` for the full command list.

## Docs

- [Agent usage guide](https://github.com/xiaolinstar/ai-todo/blob/main/docs/agent-usage.md)
- [CLI design](https://github.com/xiaolinstar/ai-todo/blob/main/docs/cli-design.md)
