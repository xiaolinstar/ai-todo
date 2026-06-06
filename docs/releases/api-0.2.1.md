# ai-todo API 0.2.1 发布说明

API 文案与 miniapp / CLI onboarding 对齐（无路由或契约变更）。

## 组件版本

| 组件 | 版本 | 本批是否 bump |
|------|------|---------------|
| API | `0.2.1` | 是 |
| CLI | `0.4.0` | 否 |
| 微信小程序 | `0.4.0` | 否 |

建议 Git `release_tag`：`v0.4.2`（与 [compatibility.md](./compatibility.md) 一致）。

## 变更摘要

- `GET /` 根页：安装命令改为 `npm install -g @xiaolinstar/ai-todo-cli`，补充 `~/.ai-todo/settings.json` 示例
- 新增 `cli_guidance.py` 集中维护 CLI 对外文案
- CLI 误用微信 session token 时的错误提示指向 PAT + settings.json
- `GET /v1/health` → `apiVersion`: `0.2.1`

## 部署后验证

```bash
curl -sS https://wodi.games/ | grep xiaolinstar
curl -sS https://wodi.games/v1/health | jq '.data.apiVersion'
```
