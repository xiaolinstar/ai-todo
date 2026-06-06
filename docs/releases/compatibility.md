# 组件版本兼容矩阵

各客户端/服务使用 **独立 SemVer**（见 [versioning.md](./versioning.md)）。下表记录「已验证可一起内测」的组合；Git `release_tag` 仅标识部署 commit，不等于所有组件同号。

## 如何阅读

| 列 | 含义 |
|----|------|
| `releaseTag` | 该批发布使用的 Git tag（CD `release_tag`，现状不变） |
| `api` | `GET /v1/health` → `apiVersion`（来自 `apps/api/pyproject.toml`） |
| `cli` | `ai-todo version` |
| `miniapp` | `apps/miniapp/package.json` + 微信上传版本号 |
| 说明 | 本批变更摘要与约束 |

版本比较默认 **SemVer**：`cli >= 0.1.2` 表示 0.1.2 及以上 patch/minor 均可，除非注明破坏性升级。

## 矩阵

| releaseTag | api | cli | miniapp | 说明 |
|------------|-----|-----|---------|------|
| `v0.4.2` | `0.2.1` | `0.4.0` | `0.4.0` | API 根页与错误提示对齐 CLI onboarding（`@xiaolinstar/ai-todo-cli` + settings.json）。无 API 契约变更。 |
| `v0.4.1` | `0.2.0` | `0.4.0` | `0.4.0` | npm 包名确定为 `@xiaolinstar/ai-todo-cli`；文档/CI 与仓库对齐。组件 L1 无变更。 |
| `v0.4.0` | `0.2.0` | `0.4.0` | `0.4.0` | CLI npm 单包发布、settings.json 配置优先、help 隐藏 login/token（仓库内包名 `@ai-todo/cli`）。 |
| `v0.3.0` | `0.2.0` | `0.3.0` | `0.3.0` | CLI / Agent 访问令牌生命周期：状态、到期、空闲失效、CLI token 子命令。 |
| `v0.2.2` | `0.1.3` | `>=0.1.4` | `0.2.2` | 账户时区可切换；提醒/日历按账户时区显示「今天」与时刻。 |
| `v0.2.1` | `0.1.3` | `>=0.1.4` | `0.2.1` | 使用偏好合一；通知渠道与免打扰；账号与安全页。API 复用通知 settings/status。 |
| `v0.2.0` | `0.1.3` | `>=0.1.4` | `0.2.0` | 我的页设置枢纽、通知/关于、设计令牌。API 使用既有 `PUT /v1/notifications/settings`。 |
| `v0.1.4` | `0.1.3` | `>=0.1.4` | `0.1.4` | 小程序编辑与左滑删除；CLI `reminder update` 全字段。API 无行为变更，沿用 0.1.3 契约。 |
| `v0.1.3` | `0.1.3` | `>=0.1.1` | `0.1.3` | 应用内联系人创建；CLI 联系人字段与小程序对齐。 |
| `v0.1.2` | `0.1.2`–`0.1.3` | `>=0.1.0` | `0.1.2` | 隐私授权登录、资料设置、创建表单体验。 |
| `v0.1.1` | `0.1.1`+ | `>=0.1.0` | `0.1.1` | 内测修订：列表、删除、部署修复。 |

## 发布时如何更新

1. 仅 bump **本批有代码变更** 的组件 `package.json` / `pyproject.toml`。
2. 在本文件 **追加一行** 或更新对应 `releaseTag` 行。
3. 在 `docs/releases/vX.Y.Z.md` 中增加 **组件版本** 小节（与 Git tag 叙事可同名，如「v0.1.4」）。

## 运行时核对

```bash
# API（本地或线上）
curl -sS http://127.0.0.1:3100/v1/health | jq '.data | {apiVersion, releaseTag, gitSha}'

# CLI
ai-todo version --json
```

小程序在微信开发者工具 → 详情 → 本地设置 / 上传记录中查看体验版版本号，应与 `apps/miniapp/package.json` 一致。
