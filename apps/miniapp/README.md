# ai-todo Miniapp

微信小程序 MVP（编码风格对齐 [party-helper](../party-helper)）。

**规范文档（必读）**：[docs/miniapp-conventions.md](../../docs/miniapp-conventions.md)

## 技术栈

- 源码：**TypeScript + Sass + WXML + JSON**（每页面/组件 **四件套**）
- 编译：**微信开发者工具** `typescript` / `sass` 插件（与 party-helper 一致）
- **`.js` / `.wxss`**：由 DevTools 生成；IDE 中默认隐藏（`.vscode/settings.json`）
- 工程根目录：`apps/miniapp`（DevTools 导入此目录）

## 本地开发

```bash
pnpm dev:api
# 微信开发者工具 → 导入 apps/miniapp → 确认已启用 TS/Sass 编译插件
# 详情 → 勾选「不校验合法域名」
pnpm clean:wechat  # 删除本地 .js/.wxss 后再打开 DevTools
pnpm check:wechat   # 提交前
```

开发者工具下 API 默认 `http://127.0.0.1:3100`（见 `lib/config.ts`）。

## 生产 / 体验版

### 1. 部署 API + Gateway

按 [docs/deploy.md](../../docs/deploy.md)：`https://wodi.games` → gateway → 宿主机 `:8082`。

### 2. 合法域名（微信公众平台，非代码）

在 [微信公众平台](https://mp.weixin.qq.com/) 或[测试号](https://mp.weixin.qq.com/debug/cgi-bin/sandbox) → **开发设置 → 服务器域名**：

| 类型 | 填写 |
|------|------|
| request 合法域名 | `https://wodi.games`（测试号界面要求带 `https://`；正式号后台通常只填 `wodi.games`） |

- **只在公众平台后台填写**，不在小程序源码里配置
- 不要带路径或端口（如 `/v1`、`:8082`）

### 3. 小程序工程

| 项 | 位置 |
|----|------|
| AppID | `project.config.json` |
| API 基址 | 代码默认 `https://wodi.games`（体验版/正式版） |
| 登录 | 「我的」→ **微信登录** |

真机验证时关闭开发者工具「不校验合法域名」。

```bash
pnpm check:wechat
```

## 常见问题

| 现象 | 处理 |
|------|------|
| DevTools 语法/重复文件警告 | 运行 `pnpm clean:wechat` 删除旧 `.js`/`.wxss`，再让 DevTools 从 `.ts`/`.scss` 重新编译 |
| `未找到 pages/.../xxx.js` | 确认 `project.config.json` 已启用 `useCompilerPlugins: ["typescript","sass"]`；DevTools 重新编译 |
| 改了 .ts 没生效 | DevTools「编译」→「清缓存」→ 重新编译 |
| 无法连接 API（本地） | 勾选「不校验合法域名」；API 用 `127.0.0.1:3100` |
| 无法连接 API（真机） | 公众平台配置 `wodi.games`；确认 `https://wodi.games/v1/health` |
| Git 里出现 .js/.wxss | 勿提交；运行 `git rm --cached` 移除跟踪 |

## Tab 结构

| Tab | 页面 | 说明 |
|-----|------|------|
| 提醒 | `pages/reminders/reminders` | 默认今日视角 |
| 日历 | `pages/calendar/calendar` | 默认今天 |
| 通讯录 | `pages/contacts/contacts` | 联系人列表与新建 |
| 我的 | `pages/mine/mine` | 微信登录、连接状态 |

子页面：`reminder-create`、`event-create`、`contact-picker`
