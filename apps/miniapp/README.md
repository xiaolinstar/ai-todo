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
| 无法连接 API | 设置页检查地址；模拟器用 `127.0.0.1:3100` |

## 目录结构

```text
apps/miniapp/
  project.config.json
  miniprogram/
    app.ts / app.js / app.scss / app.wxss
    lib/
    pages/<name>/<name>.{ts,js,wxml,scss,wxss,json}
```
