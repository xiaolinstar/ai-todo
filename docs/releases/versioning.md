# ai-todo 版本计划

ai-todo 采用 **组件独立 SemVer** + **Git release tag 驱动 CD** 的双轨模型。

## 两层版本（核心模型）

### L1：组件版本（各子项目独立发展）

每个可发布产物维护自己的语义化版本，**不要求**与 Git tag 或其他组件同号。

| 组件 | 版本源文件 | 运行时查询 |
|------|------------|------------|
| FastAPI 服务端 | `apps/api/pyproject.toml` | `GET /v1/health` → `data.apiVersion` |
| ai-todo CLI | `apps/cli/package.json` | `ai-todo version` / `ai-todo version --json` |
| 微信小程序 | `apps/miniapp/package.json` | 上传版本号 +（可选）关于页 |
| 共享库 | `packages/*/package.json` | npm 包版本；随 API 契约变更单独递增 |
| 未来（MCP、独立服务等） | 各自 `package.json` 或 `pyproject.toml` | 各自 health / `version` 子命令 |

递增规则（按**该组件**变更判断）：

- **patch**：bug、文案、小 UI、测试、文档、无契约变更的配置。
- **minor**：新能力、新命令/路由、向后兼容的字段扩展。
- **major**：破坏性 API/CLI/数据迁移；内测阶段尽量避免。

Monorepo 根目录 `package.json` 的 `version` 仅表示仓库工具链，**不代表**产品或 API 版本。

### L2：Git release tag（CI/CD 现状保持不变）

- Git 使用带 `v` 前缀的 annotated tag，例如 `v0.1.4`。
- 生产 CD 继续只填 **`release_tag`**（如 `v0.1.4`），由 workflow 解析 tag → commit → 镜像；回滚仍可用 `ci_run_id`。
- 部署后 `GET /v1/health` 返回 `releaseTag`、`gitSha`（构建身份，L2），与 `apiVersion`（L1）并存。

```bash
git tag -a v0.1.4 -m "release train v0.1.4"
git push origin main
git push origin v0.1.4
```

**`release_tag` 标识「哪次 commit 被部署」**，不强制 `api` / `cli` / `miniapp` 的 L1 数字相同。

### L3：发布叙事（给人看的 release train）

- `docs/releases/v0.1.4.md` 等描述「这一批交付什么能力」。
- 标题可用 `v0.1.4`，正文必须写清 **本批各组件 L1 版本组合**（见 [compatibility.md](./compatibility.md)）。

示例（v0.1.4）：

| 字段 | 值 |
|------|-----|
| Git `releaseTag` | `v0.1.4` |
| api | `0.1.3`（无 API 行为变更） |
| cli | `0.1.4` |
| miniapp | `0.1.4` |

## 微信小程序版本号

- 上传/体验版表单填写 **miniapp L1**（不带 `v`），例如 `0.1.4`。
- `develop` / `trial` / `release` 由微信 `envVersion` 控制，与 L1 正交。

## 兼容性关系

客户端能否工作，以 [compatibility.md](./compatibility.md) 为准（最低 `api` + 推荐 `cli` / `miniapp`），而不是「所有端都叫 0.1.4」。

可选增强（非必须）：

- 请求头 `x-client-version`（CLI/小程序上报 L1，便于日志）。
- OpenAPI / `docs/api-design.md` 作为 API 契约真源。

## 路线图（产品叙事，非组件版本）

当前处于小范围内测阶段，目标是「先能稳定运行」。

- `0.1.0`：首个可内测运行版本（微信登录、提醒、日历、通讯录、CLI/Agent、生产 API）。
- `0.1.1`：内测修订（UI、登录、列表、删除、部署）。
- `0.1.2`：隐私授权登录、资料设置、创建表单、合规门禁。
- `0.1.3`：应用内联系人创建；CLI 联系人字段对齐。
- `0.1.4`：提醒/日历/联系人**再编辑**；列表左滑删除；CLI `reminder update` 对齐 API。
- `0.2.0`：内测体验增强。P0 完善「我的」与通知/关于设置；P1 提醒与今日呈现；星标/撤销删除等推迟。
- `0.2.1`：使用偏好（提醒/日历/通讯录合一）、通知渠道分工、账号与安全文案、提醒列表 P1。
- `0.2.2`：账户时区切换与全站按账户时区显示；平台 username/建联推迟（见 [v0.2.2-plan.md](./v0.2.2-plan.md)、[platform-identity.md](../product/platform-identity.md)）。
- `0.2.3`：CD 六步扩展（发布后拨测/黑盒 → 失败回滚 → 回滚复验 → 发布报告）；换域仅 **xiaolin-gateway** 运维（见 [v0.2.3-plan.md](./v0.2.3-plan.md)、[v0.2.3-cd-pipeline-plan.md](./v0.2.3-cd-pipeline-plan.md)）。
- `0.3.0`：CLI 访问令牌生命周期、加密存储后可 reveal、小程序令牌 UI、`ai-todo token`（见 [v0.3.0-plan.md](./v0.3.0-plan.md)）。
- `0.6.0`：提醒来源外键与反查（`source` / `externalId` / `sourceMeta`）；CLI 来源快捷操作；小程序编辑页只读来源（见 [v0.6.0.md](./v0.6.0.md)）。
- `0.6.1`：Agent 工具链闭环（agent-protocol、Skill、文档对齐 v0.6.0 来源能力）；无 API/小程序变更（见 [v0.6.1-plan.md](./v0.6.1-plan.md)）。
- `0.6.2`：MCP stdio Server（仓库内），宿主零 shell 调用 CLI 能力（见 [v0.6.2-plan.md](./v0.6.2-plan.md)）。
- `0.6.2.1`：MCP npm 首发 `@xiaolinstar/ai-todo-mcp@0.1.0`；CLI npm `0.5.1`；文档 `npx` 默认路径（见 [v0.6.2.1.md](./v0.6.2.1.md)）。
- `0.7.0`（候选）：小程序来源角标 + 提醒列表分组；无 API 变更（见 [v0.7.0-plan.md](./v0.7.0-plan.md)）。
- `0.4.0`：CLI npm 全局安装、配置优先 UX、小程序复制 settings JSON（见 [v0.4.0-plan.md](./v0.4.0-plan.md)）。
- `0.4.1`：Git 发布火车；npm 包名 `@xiaolinstar/ai-todo-cli` 与文档/CI 对齐（组件 L1 不变，见 [v0.4.1.md](./v0.4.1.md)）。
- `0.4.3`：生产 API 域名 `xingxiaolin.cn`；API `0.2.2`（见 [v0.4.3.md](./v0.4.3.md)、[api-0.2.2.md](./api-0.2.2.md)）。
- `0.3.x`：MCP、审计只读、提醒 P2 等（原 Agent 增强剩余项）。
- `1.0.0`：稳定公开版本。

上述条目是 **release train 主题**；各组件 L1 仍按实际改动单独 bump。

## 发布流程（修订）

1. 在 `main` 完成候选功能并通过门禁（`pnpm test:api`、`pnpm check:wechat` 等）。
2. **仅 bump 有变更的组件** L1 版本号。
3. 更新 `docs/releases/vX.Y.Z.md`、追加 [compatibility.md](./compatibility.md) 一行。
4. 提交并创建 Git tag `vX.Y.Z`（CD 仍用此 `release_tag`）。
5. 推送 `main` 与 tag；手动触发 CD（`release_tag=vX.Y.Z`）。
6. 微信小程序上传，版本号 = **miniapp L1**。
7. 验收核对：

```bash
curl -sS "$API_URL/v1/health" | jq '.data | {apiVersion, releaseTag, gitSha}'
ai-todo version --json
```

只有当 `main` 继续高风险开发且需长期 hotfix 已发布版本时，才考虑 release 分支。当前默认 `main` + tag。

## 相关文档

- [compatibility.md](./compatibility.md) — 已验证的组件版本组合
- [release-runbook.md](../release-runbook.md) — CD 与回滚
- [deploy.md](../deploy.md) — `releaseTag` / `gitSha` 注入说明
