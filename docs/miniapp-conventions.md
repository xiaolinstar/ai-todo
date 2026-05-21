# ai-todo 微信小程序规范

日期：2026-05-21

本文约定 ai-todo 微信小程序的目录结构、技术栈与编码风格。**对齐同目录下的 [party-helper](https://github.com/) 项目**（`../party-helper/apps/wechat-miniprogram`），便于在多项目间保持一致的可维护性。

## 参考来源

| 项目 | 路径 | 说明 |
|------|------|------|
| party-helper | `AgentProjects/party-helper/apps/wechat-miniprogram` | 聚会桌游发牌器，canonical 小程序实现 |
| party-helper 规范 | `party-helper/AGENTS.md` § UI 与体验约束 | 布局、颜色角色、检查命令 |
| party-helper 色板 | `party-helper/docs/ui-color-roles.md` | 角色化 CSS 变量说明 |

ai-todo 与 party-helper 的业务差异：

- party-helper：规则在 `packages/games/*`，小程序只做展示与平台适配；
- ai-todo：数据来自后端 REST API，小程序通过 `miniprogram/lib/api.ts` 调用，**不在页面内重复实现业务规则**。

## 技术栈

- **微信原生**（不使用 Taro / uni-app）
- **TypeScript + Sass 为源码**（`.ts` / `.scss`，编码风格对齐 party-helper）
- **微信开发者工具加载预构建产物**（`.js` / `.wxss`，由 `pnpm build:wechat` 生成并提交仓库）
- **ES Module 编写、`require` 运行**：源码用 `import`，构建后转为 CommonJS 供小程序加载

> 说明：party-helper 依赖 DevTools 的 `typescript`/`sass` 编译插件做实时编译；ai-todo 额外提供 **`pnpm build:wechat`**，避免本地 DevTools 未启用插件时出现「找不到 .js」等大量报错。若你的 DevTools 已正确启用插件，也可在 `project.config.json` 中恢复 `useCompilerPlugins: ["typescript", "sass"]` 并省略提交 `.js`/`.wxss`（与 party-helper 完全一致）。

`project.config.json` 默认：

```json
{
  "miniprogramRoot": "miniprogram/",
  "setting": {
    "useCompilerPlugins": [],
    "es6": true
  }
}
```

## 目录结构

```text
apps/miniapp/
  project.config.json       # 微信开发者工具工程根（miniprogramRoot 指向子目录）
  tsconfig.json             # 小程序 TS 严格检查（noEmit）
  types/
    wechat-miniprogram.d.ts # 最小 wx 类型补充（可按需扩展）
  miniprogram/
    app.json
    app.ts
    app.scss                # 全局 design tokens + 通用组件类
    sitemap.json
    lib/                    # 平台层：API、存储、格式化（无 WXML）
    pages/
      <feature>/
        <feature>.ts
        <feature>.wxml
        <feature>.scss
        <feature>.json
```

约束：

- 开发者工具 **打开目录为 `apps/miniapp`**，不是 `miniprogram/` 子目录本身
- 页面路径在 `app.json` 中为 `pages/<name>/<name>`（**目录名与主文件名一致**，不用 `index`）
- 子页面、非 Tab 流程页同样遵循四件套命名

## 页面职责

页面（`pages/**`）只负责：

- 数据绑定与 `setData`
- 用户事件、导航（`wx.navigateTo` / `navigateBack`）
- 调用 `lib/` 中的 API / 存储
- 必要时 `onShareAppMessage`（若产品需要分享）

**不要**在页面内：

- 拼接 HTTP 细节（放 `lib/api.ts`）
- 复制后端校验规则
- 硬编码散落的颜色（用 `app.scss` 变量）

## 样式与设计 token

全局 token 定义在 `miniprogram/app.scss` 的 `page { --todo-*: ... }` 中，命名空间使用 **`--todo-`**（party-helper 使用 `--party-`）。

### 颜色角色（与 party-helper 同模型）

| 角色 | 用途 |
|------|------|
| `--todo-primary` | 主操作、链接（iOS 蓝 #007AFF） |
| `--todo-good` | 成功、完成态 |
| `--todo-danger` | 逾期、删除、警示 |
| `--todo-bg-page` | 分组背景（#F2F2F7） |
| `--todo-surface` | 卡片、面板 |
| `--todo-text-primary` / `secondary` / `muted` / `subtle` | 文字层级 |
| `--todo-border-subtle` / `--todo-border-card` | 分割线与卡片描边 |

新增 UI 状态时，**先判断能否映射到已有角色**；不要为局部装饰随意加色值。详见 party-helper 的 `docs/ui-color-roles.md` 思路。

### 布局类（复用 party-helper 模式）

优先使用 `app.scss` 中已定义的：

- `.page` — 页面容器
- `.large-title` / `.large-subtitle` — Apple 大标题区
- `.inset-group` / `.list-cell` — iOS 分组列表
- `.form-group` / `.form-row` — iOS 表单行
- `.week-strip` / `.day-circle` — 日历周视图
- `.fab` — 圆形 + 悬浮按钮
- `.todo-button` + `.todo-button-primary` / `-secondary` / `-ghost`

### 布局稳定性（来自 party-helper AGENTS.md）

- 工具型页面：顶部状态区、主内容区、底部操作区边界清晰，避免按钮随文案跳动
- 网格与列表：`minmax(0, 1fr)`、`box-sizing: border-box`、控制换行与溢出
- 全局：`view, text, button { box-sizing: border-box; }`，`button::after { border: none; }`

## TypeScript 约定

- `tsconfig.json`：`strict: true`，`noEmit: true`
- 页面注册：`Page({ ... })`，应用：`App({ ... })`
- 事件参数：可先用 `WechatMiniprogram.CustomEvent` 或 `any`，与 party-helper 一致，逐步收紧
- 仅在 `lib/` 导出类型；页面 `data` 内联类型可用 `as` 断言
- 路径：相对路径、`../../lib/...`，不带扩展名

## 路由与 TabBar

- Tab 页在 `app.json` → `tabBar.list` 中声明；**不要用 `navigateTo` 打开 Tab 页并携带 query**（微信会 `switchTab` 且丢失参数）
- 需要「选择后返回」的流程，使用 **非 Tab 子页**（如 `contact-picker`）+ `getOpenerEventChannel()`
- 非 Tab 页：`wx.navigateTo`；完成后 `wx.navigateBack`

## 网络与配置

- API 基址与 PAT 存 `wx.storage`（`lib/config.ts`）
- 请求统一走 `lib/api.ts`，请求头含 `x-client-source: miniapp`
- 本地开发：开发者工具勾选「不校验合法域名」；真机使用局域网 IP
- MVP 可无 Token（后端 dev 旁路）；生产环境使用 PAT

## 检查命令

仓库根目录：

```bash
pnpm build:wechat     # .ts→.js、.scss→.wxss（改小程序源码后必跑）
pnpm check:wechat     # typecheck + build + 页面完整性
pnpm typecheck:wechat # 仅 tsc
```

修改 `miniprogram/**` 下的 `.ts` 或 `.scss` 后，**至少运行 `pnpm build:wechat`**，再在微信开发者工具中编译/预览。

## 文档语言

与 party-helper 一致：产品/规范类文档使用**中文**，全角标点；命令、路径、变量名保持英文原样。

## 与 party-helper 的差异清单

| 项 | party-helper | ai-todo |
|----|--------------|---------|
| CSS 前缀 | `--party-*` | `--todo-*` |
| 核心逻辑位置 | `packages/games/*` + vendor 同步 | 后端 API + `lib/api.ts` |
| TabBar | 无（单首页入口） | 自定义 TabBar：4 图标 + 居中「+」新建 |
| 分享 | 首页/设置/反馈均 `lib/share.ts` | MVP 可选，待产品需要时补齐 |
| CI 脚本 | `check:wechat-vendor` | 无 vendor；仅 `check:wechat` |

## 新页面 Checklist

- [ ] `pages/<name>/<name>.{ts,wxml,scss,json}` 四文件齐全
- [ ] 已在 `app.json` `pages` 数组注册（Tab 页同时更新 `tabBar`）
- [ ] 样式使用 `--todo-*` 与全局 layout 类，无随意 hex
- [ ] 业务调用经 `lib/`，页面无裸 `wx.request`
- [ ] 运行 `pnpm check:wechat` 通过
