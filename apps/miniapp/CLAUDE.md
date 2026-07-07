# apps/miniapp/CLAUDE.md

> 微信小程序（`@ai-todo/miniapp`）项目级 Agent 引导。
> 通用标准在 [`~/AgentProjects/dev-standards/playbook/wechat-mp.md`](../../../../../dev-standards/playbook/wechat-mp.md)。

## 关键事实

- **包名**：`@ai-todo/miniapp`（private）
- **当前版本**：`0.8.8`（与 `miniprogram/lib/version.ts` 同步；改版本用 `pnpm bump-version`）
- **技术栈**：原生微信小程序 + TypeScript + Sass + WXML（**四件套**：`.ts` / `.wxml` / `.scss` / `.json`）
- **不在范围**：Taro / uni-app / 跨端方案
- **依赖**：[`miniprogram-ci`](https://www.npmjs.com/package/miniprogram-ci)（仅 devDependencies）、`sass`、`typescript`

## 必读文档

| 文档                                                                                                      | 作用                                       |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [README.md](README.md)                                                                                    | 本地开发 + 分环境 + 域名 + FAQ（**先读**） |
| [docs/miniapp-conventions.md](../../docs/miniapp-conventions.md)                                          | 项目级编码规范（目录、命名、四件套约定）   |
| [docs/miniapp-design-tokens.md](../../docs/miniapp-design-tokens.md)                                      | 颜色 / 字体令牌                            |
| [~/AgentProjects/dev-standards/playbook/wechat-mp.md](../../../../../dev-standards/playbook/wechat-mp.md) | 跨项目通用基线（标准库）                   |
| [~/AgentProjects/dev-standards/skills/wechat-mp/](../../../../../dev-standards/skills/wechat-mp/)         | 小程序 domain Skill（API 模式、坑点）      |

## 三档环境

| 环境                  | 触发                              | API 基址                            | 微信后台           |
| --------------------- | --------------------------------- | ----------------------------------- | ------------------ |
| **dev**（开发版）     | `pnpm miniapp:preview` 或本地预览 | `http://127.0.0.1:3100`（API 本地） | 开发版（自动）     |
| **trial**（体验版）   | 微信开发者工具上传 + 配置体验成员 | `https://staging.xingxiaolin.cn`    | 体验版（半自动）   |
| **release**（正式版） | 微信后台提交审核                  | `https://xingxiaolin.cn`            | 正式版（**人工**） |

**注意**：trial/release 上传**不走 CI**（用微信开发者工具），原因：IP 白名单 + 运维习惯（README §"命令行预览"）。

## AppID 处理方式

`project.config.json` 故意用 `touristid`（占位），**真实 AppID 在 `project.private.config.json`**（已 gitignore）。

```bash
# 首次拉代码
cp project.private.config.example.json project.private.config.json
# 编辑 project.private.config.json，填入真实 AppID
```

CI 不会上传小程序（见上），所以 CI 不需要 AppID 走 Secrets。**这是 ai-todo 的有意选择**（与 wechat-mp.md 默认"用真实 appid + Secrets"不同）。两种都 OK。

## 常用命令

```bash
# 仓库根目录（用 pnpm filter）
pnpm check:wechat     # typecheck + build:check + 静态规则
pnpm miniapp:preview  # 生成体验版二维码（需 ci.env + 真实 AppID）
pnpm miniapp:upload   # 当前 exit 1（用微信开发者工具上传）

# 或进 apps/miniapp 目录
cd apps/miniapp
pnpm check
pnpm preview
pnpm upload           # 当前 exit 1
```

## 目录速查

```
apps/miniapp/
├── project.config.json              # DevTools 工程根（appid: touristid）
├── project.private.config.json      # gitignore，真实 AppID
├── ci.env                           # gitignore，miniprogram-ci 配置
├── private.wx*.key                  # gitignore，代码上传密钥
├── scripts/                         # build / check / clean / miniapp-ci
├── tsconfig.json                    # strict, noEmit
├── types/wechat-miniprogram.d.ts    # 最小 wx 类型补充
└── miniprogram/                     # DevTools miniprogramRoot
    ├── app.json / app.ts / app.scss
    ├── pages/<feature>/<feature>.{ts,wxml,scss,json}  # 四件套
    ├── lib/                         # 平台层（API、存储、格式化、token、theme）
    ├── components/                  # 自定义组件
    ├── styles/                      # tokens / typography
    └── assets/                      # ⚠️ 优先放 CDN，本地尽量小
```

## 与 wechat-mp.md 标准库的偏差

ai-todo 的 miniapp 与 [wechat-mp.md](../../../../../dev-standards/playbook/wechat-mp.md) 有意的差异（保留现状即可，**不强制改**）：

| 项              | ai-todo                           | wechat-mp.md                              |
| --------------- | --------------------------------- | ----------------------------------------- |
| 上传方式        | 微信开发者工具（手动）            | miniprogram-ci 上传（CI）                 |
| 目录            | `lib/` 一个目录装所有平台层       | `services/` + `stores/` + `utils/` 分目录 |
| AppID           | `touristid` 占位 + private config | 真实 appid + Secrets                      |
| 组件复用        | 几乎没有（业务内嵌 pages）        | 业务通用组件放 `components/`              |
| CI miniapp 阶段 | typecheck + build（**不上传**）   | dev 自动上传开发版                        |

## 跑起来（30 秒）

```bash
# 1. API
pnpm dev:api
# 2. 微信开发者工具 → 导入 apps/miniapp
# 3. 详情 → 勾选「不校验合法域名」
# 4. 详情 → 本地设置 → 调试基础库选 3.15.0
# 5. 编译 → 预览
```

## 常见坑

详见 [`~/AgentProjects/dev-standards/skills/wechat-mp/references/pitfalls.md`](../../../../../dev-standards/skills/wechat-mp/references/pitfalls.md)，以及 [README.md §常见问题](README.md#常见问题)。
