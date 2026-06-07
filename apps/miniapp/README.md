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
```

**小程序包内命令**（在 `apps/miniapp` 目录）：

```bash
pnpm clean          # 删除 miniprogram 下本地 .js/.wxss
pnpm check          # typecheck + 编译检查 + 静态规则
pnpm preview        # miniprogram-ci 预览（需 ci.env）
pnpm upload         # miniprogram-ci 上传
```

**仓库根目录快捷方式**（等价转发）：

```bash
pnpm clean:wechat
pnpm check:wechat   # 提交前
pnpm miniapp:preview
pnpm miniapp:upload
```

开发者工具下 API 默认 `http://127.0.0.1:3100`（见 `lib/config.ts`）。

### AppID 配置

仓库提交的 `project.config.json` 固定使用 `touristid`，避免把真实小程序 AppID 写入共享配置。

本地需要微信登录、订阅消息或真机预览时，复制私有配置模板：

```bash
cp apps/miniapp/project.private.config.example.json apps/miniapp/project.private.config.json
```

然后把 `project.private.config.json` 中的 `appid` 改为你的真实小程序 AppID。该文件已加入 `.gitignore`，不会提交到 GitHub。

### 命令行预览 / 上传（miniprogram-ci）

无需打开微信开发者工具，可用官方 [miniprogram-ci](https://www.npmjs.com/package/miniprogram-ci) 生成体验版二维码或上传代码。

**一次性准备：**

1. `project.private.config.json` 中配置真实 AppID（见上文）
2. [微信公众平台](https://mp.weixin.qq.com/) → **开发管理 → 小程序代码上传 → 上传密钥**，下载 `private.wxXXXX.key`
3. 将密钥放在 **`apps/miniapp/`** 目录下（文件名形如 `private.wxYOUR_APPID.key`），已在 `.gitignore` 中，**不会提交到 Git**
4. （可选）复制 `ci.env.example` 为 `ci.env` 并指定路径；若目录内只有一个 `private.wx*.key`，`pnpm preview` 会自动识别

```bash
cp ci.env.example ci.env
# 默认: WECHAT_CI_PRIVATE_KEY_PATH=./private.wxYOUR_APPID.key
set -a && source ci.env && set +a   # 可省略，若密钥已在 apps/miniapp/ 且仅一份
```

**常用命令**（在 `apps/miniapp` 目录，或仓库根目录用 `pnpm miniapp:*`）：

```bash
pnpm preview                                      # 二维码 → .preview/preview.jpg
pnpm preview -- --page pages/reminders/reminders
pnpm upload -- --desc "v0.5.4 体验版"              # 版本号读 miniprogram/lib/version.ts

# 仓库根目录快捷方式：
pnpm miniapp:preview
pnpm miniapp:upload -- --desc "v0.5.4 体验版"
```

微信扫码即可真机调试。上传密钥 **IP 白名单**需包含本机公网 IP（含 IPv6；开发可临时填 `0.0.0.0/0`）。Node.js 25+ 需通过 `scripts/run-ci.mjs` 启动（`pnpm preview` 已封装）。

## 生产 / 体验版

### 1. 部署 API + Gateway

按 [docs/deploy.md](../../docs/deploy.md)：`https://xingxiaolin.cn` → gateway → 宿主机 `:8082`。

### 2. 合法域名（微信公众平台，非代码）

在 [微信公众平台](https://mp.weixin.qq.com/) 或[测试号](https://mp.weixin.qq.com/debug/cgi-bin/sandbox) → **开发设置 → 服务器域名**：

| 类型 | 填写 |
|------|------|
| request 合法域名 | `https://xingxiaolin.cn`（测试号界面要求带 `https://`；正式号后台通常只填 `xingxiaolin.cn`） |

- **只在公众平台后台填写**，不在小程序源码里配置
- 不要带路径或端口（如 `/v1`、`:8082`）

### 3. 小程序工程

| 项 | 位置 |
|----|------|
| AppID | `project.private.config.json`（本地真实 AppID）；`project.config.json` 仅提交 `touristid` |
| API 基址 | 代码默认 `https://xingxiaolin.cn`（体验版/正式版） |
| 登录 | 「我的」→ **微信登录** |

**域名切换**：自 0.4.0 起生产基址为 `xingxiaolin.cn`。若体验版仍连旧域，需重新上传小程序；网关侧 `wodi.games` 暂保留至全量切换完成。

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
| 无法连接 API（真机） | 公众平台配置 `xingxiaolin.cn`；确认 `https://xingxiaolin.cn/v1/health` |
| Git 里出现 .js/.wxss | 勿提交；运行 `git rm --cached` 移除跟踪 |

## Tab 结构

| Tab | 页面 | 说明 |
|-----|------|------|
| 提醒 | `pages/reminders/reminders` | 默认今日视角 |
| 日历 | `pages/calendar/calendar` | 默认今天 |
| 通讯录 | `pages/contacts/contacts` | 联系人列表与新建 |
| 我的 | `pages/mine/mine` | 微信登录、连接状态 |

子页面：`reminder-create`、`event-create`、`contact-picker`
