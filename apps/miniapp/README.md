# ai-todo Miniapp

微信小程序 MVP（编码风格对齐 [party-helper](../party-helper)）。

**规范文档（必读）**：[docs/miniapp-conventions.md](../../docs/miniapp-conventions.md)

## 技术栈

- 源码：**TypeScript + Sass**（`miniprogram/**/*.ts` / `*.scss`）
- 运行：**JavaScript + WXSS**（`pnpm build:wechat` 生成，已提交仓库供 DevTools 直接加载）
- 工程根目录：`apps/miniapp`（含 `miniprogramRoot: miniprogram/`）

## 本地开发

```bash
# 1. 启动 API
pnpm dev:api

# 2. 若改过 .ts / .scss，重新构建小程序产物
pnpm build:wechat

# 3. 微信开发者工具 → 导入 apps/miniapp
#    详情 → 勾选「不校验合法域名」→ 编译
```

静态检查：

```bash
pnpm check:wechat
```

## 常见问题

| 现象 | 处理 |
|------|------|
| `未找到 pages/.../xxx.js` | 运行 `pnpm build:wechat` 后重新编译 |
| 改了页面没生效 | 同上，DevTools 读的是 `.js` 不是 `.ts` |
| 无法连接 API | 「我的」页检查地址；模拟器用 `127.0.0.1:3100` |
| 底部 TabBar 空白 | 运行 `pnpm build:wechat`；开发者工具「编译」→「清缓存」→ 重新编译；详情里基础库 ≥ 2.5.0 |

## Tab 结构

| Tab | 页面 | 说明 |
|-----|------|------|
| 提醒 | `pages/reminders/reminders` | 默认今日视角，接 `/v1/reminders/today` |
| 日历 | `pages/calendar/calendar` | 默认今天，可切换日期 |
| 通讯录 | `pages/contacts/contacts` | 联系人列表与新建 |
| 我的 | `pages/mine/mine` | API 配置、PAT、账号信息 |

子页面：`reminder-create`、`event-create`、`contact-picker`

## 目录结构

```text
apps/miniapp/
  project.config.json
  miniprogram/
    app.ts / app.js / app.scss / app.wxss
    lib/
    pages/<name>/<name>.{ts,js,wxml,scss,wxss,json}
```
