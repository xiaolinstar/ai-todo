# ai-todo Miniapp

微信小程序 MVP（编码风格对齐 [party-helper](../party-helper)）。

**规范文档（必读）**：[docs/miniapp-conventions.md](../../docs/miniapp-conventions.md)

## 技术栈

- 源码：**TypeScript + Sass**（`miniprogram/**/*.ts` / `*.scss`）
- 运行：**JavaScript + WXSS**（`pnpm build:wechat` 生成，已提交仓库供 DevTools 直接加载）
- 工程根目录：`apps/miniapp`（含 `miniprogramRoot: miniprogram/`）

## 本地开发

```bash
pnpm dev:api
pnpm build:wechat
# 微信开发者工具 → 导入 apps/miniapp
# 详情 → 勾选「不校验合法域名」
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
| `未找到 pages/.../xxx.js` | `pnpm build:wechat` 后重新编译 |
| 无法连接 API（本地） | 勾选「不校验合法域名」；API 用 `127.0.0.1:3100` |
| 无法连接 API（真机） | 公众平台配置 `wodi.games`；确认 `https://wodi.games/v1/health` |
| request 不在合法域名列表 | 检查公众平台域名配置，非代码问题 |

## Tab 结构

| Tab | 页面 | 说明 |
|-----|------|------|
| 提醒 | `pages/reminders/reminders` | 默认今日视角 |
| 日历 | `pages/calendar/calendar` | 默认今天 |
| 通讯录 | `pages/contacts/contacts` | 联系人列表与新建 |
| 我的 | `pages/mine/mine` | 微信登录、连接状态 |

子页面：`reminder-create`、`event-create`、`contact-picker`
