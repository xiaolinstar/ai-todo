# ai-todo 小程序：颜色与字体规范

日期：2026-06-03

本文是 `docs/miniapp-conventions.md` 的专项补充，定义**唯一合法**的颜色与字体来源，以及各 UI 区域如何引用。

## 原则

1. **单一事实来源**：色值与字体族只在两处维护，且必须同步：
   - 样式：`miniprogram/styles/tokens.scss`（CSS 变量 `--todo-*`）
   - 逻辑 / WXML 属性：`miniprogram/lib/design-tokens.ts`（`TODO_COLORS` 等）
2. **禁止硬编码**：页面 `.scss`、组件 `.scss`、`.wxml`、`Page` 的 `.ts` 中不得出现 `#RRGGBB`、`rgb()`、`font-family` 字面量（`tokens.scss` 除外）。
3. **不随意改字体**：全应用使用同一无衬线栈（iOS 系统字体）。用户名、ID 等**与正文相同字体**，仅通过**颜色角色**（`text-subtle`）区分层级；除非产品明确要求，不单独引入等宽字体。
4. **先映射角色，再加令牌**：新状态优先用已有 `--todo-text-*` / `--todo-fill-*`；确实不够再在 `tokens.scss` 增加语义变量，并同步 `design-tokens.ts`。

## 颜色体系

### 基础色（Brand / Semantic）

| 令牌              | 用途                 |
| ----------------- | -------------------- |
| `--todo-primary`  | 主操作、链接、选中   |
| `--todo-good`     | 完成、成功           |
| `--todo-warning`  | 警告                 |
| `--todo-danger`   | 删除、逾期、警示     |
| `--todo-accent-*` | 日历色条、头像色板等 |

### 表面与文本

| 令牌                      | 用途                       |
| ------------------------- | -------------------------- |
| `--todo-bg-page`          | 页面背景                   |
| `--todo-surface`          | 卡片、分组                 |
| `--todo-tabbar-bg`        | 自定义 TabBar 背景         |
| `--todo-text-primary`     | 标题、主内容               |
| `--todo-text-secondary`   | 次要说明                   |
| `--todo-text-muted`       | 辅助信息                   |
| `--todo-text-subtle`      | 弱化信息（**用户名展示**） |
| `--todo-text-placeholder` | 占位、空态                 |

### 填充与按压（半透明）

避免在组件里写 `rgba(0, 122, 255, 0.08)`，统一使用：

| 令牌                            | 典型场景             |
| ------------------------------- | -------------------- |
| `--todo-fill-primary-08`        | 列表 hover、行高亮   |
| `--todo-fill-primary-10`        | Chip、周历 hover     |
| `--todo-fill-primary-12`        | 勾选热区、月切换按钮 |
| `--todo-fill-danger-08` / `-12` | 删除滑条、警示 chip  |
| `--todo-fill-neutral-12`        | 搜索框背景           |
| `--todo-fill-press-dark-05`     | Tab 项按压           |

## 字体体系

### 字体族

| 令牌                      | 值                              |
| ------------------------- | ------------------------------- |
| `--todo-font-family-base` | SF / 系统无衬线栈（全应用默认） |

### 字号阶梯（rpx）

| 令牌                        | 约当 iOS       | 用途                 |
| --------------------------- | -------------- | -------------------- |
| `--todo-font-size-xs`       | Caption 2      | Tab 标签             |
| `--todo-font-size-sm`       | Caption        | 周历星期、角标       |
| `--todo-font-size-md`       | Footnote       | Chip、小按钮         |
| `--todo-font-size-base`     | Subhead / Body | 列表正文、**用户名** |
| `--todo-font-size-lg`       | Callout        | 元信息、事件时间     |
| `--todo-font-size-xl`       | Headline       | 表单标签、设置项     |
| `--todo-font-size-title`    | Title 3        | 区块标题、月标题     |
| `--todo-font-size-title-lg` | Title 2        | 资料卡昵称           |
| `--todo-font-size-display`  | Large Title    | 页头大标题           |

### 字重

`--todo-font-weight-regular`（400） / `medium`（500） / `semibold`（600） / `bold`（700）

### 排版工具类（`styles/typography.scss`）

组合使用，例如资料卡用户名：

```html
<text class="username-display todo-text-subtle todo-type-body">alice</text>
```

| 类名           | 说明               |
| -------------- | ------------------ |
| `.todo-text-*` | 颜色角色           |
| `.todo-type-*` | 字号 + 字重 + 行高 |

## 区域引用约定

| 区域         | 颜色                        | 字体                                        |
| ------------ | --------------------------- | ------------------------------------------- |
| 页头大标题   | `text-primary`              | `todo-type-large-title`                     |
| 分组标题     | `text-subtle`               | `todo-type-group-header` 或 `.group-header` |
| 列表主标题   | `text-primary`              | `cell-title`（内部用 token）                |
| 列表副文案   | `text-subtle`               | `todo-type-body`                            |
| 资料卡昵称   | `text-primary`              | `todo-type-title-lg`                        |
| 资料卡用户名 | `text-subtle`               | `todo-type-body` + `.username-display`      |
| 表单标签     | `text-primary`              | `form-label`                                |
| 主按钮       | `text-inverse` on `primary` | `todo-type-headline`                        |

## WXML / TS 无法用 CSS 变量时

微信 `switch` 的 `color`、`showModal` 的 `confirmColor` 等必须使用 hex 字符串：

```ts
import {
  TODO_SWITCH_COLOR,
  TODO_MODAL_CONFIRM_DANGER,
} from "../../lib/design-tokens";
```

```xml
<switch color="{{switchColor}}" />
```

页面 `data` 默认值或 `onLoad` 中注入，禁止在 WXML 写 `#007AFF`。

## 迁移与检查

- 历史硬编码逐步替换为 `var(--todo-*)` 或 `design-tokens.ts`。
- 修改 `tokens.scss` 后必须同步 `design-tokens.ts`（文件头注释已说明）。
- 提交前运行 `pnpm check:wechat`：脚本会拒绝 `tokens.scss` / `design-tokens.ts` 以外文件中的 `#hex` 与字面量 `font-family`。
- 字号 `font-size` 字面量仍待逐步替换为 `--todo-font-size-*`（当前检查未强制）。

## 与 party-helper 的关系

角色模型与 `party-helper/docs/ui-color-roles.md` 一致，命名空间为 `--todo-*`。新增色前先对照 party-helper 是否已有对应角色。
