# CI / CD 流水线

## 工作流一览

| 工作流 | 文件 | 触发 | 职责 |
|--------|------|------|------|
| **CI** | `.github/workflows/ci.yml` | push / PR → `main` | 扫描 → 构建 → 测试 → 发布制品清单 |
| **CD** | `.github/workflows/cd.yml` | 仅手动 `workflow_dispatch` | 校验 manifest → 部署 → 公网验收 →（失败）回滚 → 回滚复验 → 发布报告 |

CI 与 CD 通过 **`deploy-manifest.json` 制品 + `sha256` 指纹** 关联，而不是仅靠「上一次 CI 成功」的逻辑约定。

## 当前发布现状

当前采用 **主干开发 + CI/CD 分离**：

```text
本地 main 或短特性分支开发
  → push 到 main 或 PR merge 到 main
  → main CI 自动运行：质量检查、构建验证、测试、生成不可变镜像与 deploy-manifest
  → 微信小程序人工上传体验版/提审
  → 确认客户端与服务端版本节奏一致后
  → 手动触发 CD，填写发布 tag（如 v0.1.1）：按 tag 指向 commit 的 manifest 部署生产
```

`main` 不再自动部署生产。原因是 ai-todo 同时包含微信小程序客户端和 FastAPI 服务端：服务端可以由 CD 自动更新，但小程序必须人工上传体验版/提交审核。为避免两端版本不同步，生产 CD 保持手动触发。

后续可采用更严格的特性分支 + PR 模式：从最新 `main` 分出 feature 分支，PR 到 `main`，通过 CI 后 squash merge，并在 GitHub 设置 main 保护分支，只允许 PR 合并。当前一人开发阶段允许主干直接提交，但 CD 仍需手动确认后执行。

`gh pr merge <PR_NUMBER> --squash` 的作用是让 GitHub 在远端把 PR 合并进 `main`。合并后远端 `main` 产生新 commit，从而触发 main CI。本地开发者随后执行：

```bash
git switch main
git pull origin main
```

开发者日常需要关注：

- PR 上 CI 是否全绿；不绿不要 merge。
- main 上 CI 是否成功并生成了 `deploy-manifest`。
- 是否已经上传/验收匹配的小程序体验版。
- 手动 CD 是否完成部署。
- 部署后验证 `/v1/health`、`/v1/health/db` 和 `.deploy/current.json`。
- 涉及数据库 migration 时，必须遵守 [database-migrations.md](./database-migrations.md)。

## CI 阶段（细粒度 Job）

```text
Phase 1 · scan (并行)
  scan-node      → pnpm typecheck / lint / deploy-manifest 工具自检
  scan-miniapp   → typecheck + 目录结构
  scan-api       → ruff / Alembic migration guardrail

Phase 2 · build (并行，依赖对应 scan)
  build-node     → pnpm build (packages + cli)
  build-miniapp  → 上传 artifact: miniapp-dist
  build-api-image → 构建并 push GHCR 镜像 (main)；PR 仅验证 build

Phase 3 · test
  test-api       → setup Node/pnpm + pytest（含 CLI 集成测试）

Phase 4 · publish (仅 main push)
  publish-manifest → deploy-manifest.json + fingerprint
```

### 制品（Artifacts）

| 名称 | 产出 Job | 用途 |
|------|----------|------|
| `miniapp-dist` | `build-miniapp` | 小程序构建产物，由 `actions/upload-artifact` 产出 artifact digest |
| `deploy-manifest` | `publish-manifest` | CD 唯一部署依据（含镜像 digest 指纹） |
| `api-image-metadata` | `build-api-image` (PR) | PR 内记录镜像 digest，不 push |

### deploy-manifest 示例

```json
{
  "schemaVersion": 1,
  "gitSha": "abc123...",
  "artifacts": {
    "api": {
      "image": "ghcr.io/xiaolinstar/ai-todo-api@sha256:...",
      "digest": "sha256:..."
    },
    "miniapp": {
      "artifactName": "miniapp-dist",
      "contentSha256": "..."
    }
  },
  "fingerprint": "sha256:..."
}
```

CD 部署前会执行 `scripts/ci/verify_deploy_manifest.py` 校验指纹未被篡改（仅依赖 Python 标准库，VPS / Actions 均可直接调用，无需 pnpm）。

`scripts/` 目录存放**可独立运行的检查与 CI/CD 工具**，刻意不经过 `package.json` 的 pnpm scripts 包装，以便在云原生环境（GitHub Actions、VPS、容器）中直接 `node scripts/...` 或 `python3 scripts/...` 调用，降低对 monorepo 工具链的依赖：

| 脚本 | 用途 | 运行方式 |
|------|------|----------|
| `scripts/ci/smoke-deploy-manifest.mjs` | CI manifest 工具自检 | `node` |
| `scripts/ci/write-deploy-manifest.mjs` | CI 发布 deploy-manifest | `node`（需 CI 环境变量） |
| `scripts/ci/write-api-image-metadata.mjs` | PR 镜像构建元数据 | `node` |
| `scripts/ci/verify_deploy_manifest.py` | 校验 manifest 指纹 | `python3`（stdlib，VPS/CD 首选） |
| `scripts/ci/verify-deploy-manifest.mjs` | 同上（Node 本地对照） | `node` |
| `scripts/cd/check-deploy-config.mjs` | CD 部署密钥配置检查 | `node` |
| `scripts/cd/export-manifest-fields.mjs` | CD manifest 字段导出 | `node` |
| `scripts/cd/resolve-ci-run.mjs` | CD 解析 tag / CI run | `node` |
| `scripts/cd/post-deploy-verify.py` | CD 公网拨测 / 黑盒验收 | `python3` |
| `scripts/cd/write-release-report.mjs` | CD 发布报告 | `node` |
| `apps/miniapp/scripts/build-wechat-miniprogram.mjs` | 小程序 TS/SCSS 编译检查 | `pnpm --filter @ai-todo/miniapp build:check` |
| `apps/miniapp/scripts/check-wechat-miniprogram.mjs` | 小程序目录/JSON/图标静态检查 | `pnpm check:wechat` |
| `apps/miniapp/scripts/clean-wechat-miniprogram.mjs` | 清理本地生成物 | `pnpm clean:wechat` |

`apps/api/scripts/` 为 API 容器与运维脚本（Alembic 守卫、数据库 URL、密码轮换等），由 Docker entrypoint 或 `python3 apps/api/scripts/...` 直接调用。

`cd.yml` 需 `permissions.actions: read`，以便手动 CD 根据发布 tag 解析目标 commit，自动查找该 commit 的成功 CI，并下载该 CI 上传的 `deploy-manifest` 制品。

### CD 触发策略

| 工作流 | 触发 |
|--------|------|
| CI | `push` / PR → `main`（自动） |
| CD | **仅** `workflow_dispatch`（手动）；**不会**随 push 自动部署 |

日常发布（**推荐**）：先 Run CD → `environment=staging` → 填 **`release_tag`** → 验收与浸泡后，再 Run CD → `environment=production`（同一 tag）。晋升门槛见 [staging-production-promotion.md](./releases/staging-production-promotion.md)。  
`ci_run_id` 仅用于回滚或救急，见 [v0.2.3-cd-workflow-redesign.md](./releases/v0.2.3-cd-workflow-redesign.md)。

### CD Job 流程（分支式 DAG）

```text
1 Resolve → 2 Deploy → 3 Verify
              ├─ 4a Outcome published     （Verify 通过）
              ├─ 4c Outcome deploy failed （Deploy 失败）
              └─ 4b Rollback → 5b Verify after rollback → 6b Outcome not adopted
7 Release report（always，汇合）
```

| 显示名 | 说明 |
|--------|------|
| `1 · Resolve manifest` | tag / `ci_run_id` → manifest |
| `2 · Deploy` | SSH；VPS L0 health；写 `previous-success.json` |
| `3 · Verify (public API)` | `CD_PUBLIC_API_URL` 拨测 / 黑盒 |
| `4a · Outcome published` | 成功分支终点 |
| `4b–6b` | 失败时回滚 + 复验 +「未采纳」 |
| `7 · Release report` | artifact + Summary |

拓扑说明：[releases/v0.2.3-cd-workflow-redesign.md](./releases/v0.2.3-cd-workflow-redesign.md)。实现细节：[releases/v0.2.3-cd-pipeline-plan.md](./releases/v0.2.3-cd-pipeline-plan.md)。

**Workflow 结论**：仅当 `post-deploy-verify` 通过时 CD 为绿；已回滚到旧版时 CD 仍为 **失败**（`outcome: rolled_back`），便于发现「本次发布未采纳」。

### Staging 与 Production

| 项 | 现状 |
|----|------|
| workflow 输入 | 可选 `environment: production` / `staging` |
| GitHub Environments | 已配置 **`staging`** 与 **`production`**，各自独立 `DEPLOY_*`、`CD_PUBLIC_API_URL` |
| 小程序映射 | 体验版 / 预览 / 真机调试 → staging API；正式版 → production API |
| 晋升策略 | **staging 先发布、达标后再 production**（当前人工 checklist；自动化门禁待实现） |

策略全文：[staging-production-promotion.md](./releases/staging-production-promotion.md)。环境模板：[env/README.md](./env/README.md)。

`resolve-manifest` 在选 staging 时若 Environment 未配置会打出 warning。

### Secret 清单（按存放位置）

**推荐**：`staging` 与 `production` 各自在 GitHub Environment 中配置 `DEPLOY_*`、`CD_PUBLIC_API_URL`；勿让两环境共用同一 VPS 除非刻意为之。

#### A. GitHub Secrets（Actions 用，不在 VPS 上配置）

CD 里带 `environment: production` 的 Job **同时可读**：

1. **Environment `production` 的 Secrets**（同名时优先）
2. **Repository secrets**（仓库级，你原来的 `DEPLOY_*` 放这里即可）

**推荐（与现状兼容，无需迁移旧密钥）：**

| Secret | 必填 | 建议存放 | 说明 |
|--------|------|----------|------|
| `DEPLOY_HOST` | 是 | **Repository**（保持现状） | VPS IP 或 SSH 主机名 |
| `DEPLOY_USER` | 是 | **Repository** | SSH 用户名 |
| `DEPLOY_SSH_KEY` | 二选一 | **Repository** | 与 `DEPLOY_PASSWORD` 二选一 |
| `DEPLOY_PASSWORD` | 二选一 | **Repository** | SSH 密码 |
| `DEPLOY_PORT` | 否 | Repository | 默认 22 |
| `DEPLOY_PATH` | 否 | Repository | 默认 `$HOME/AgentProjects/ai-todo` |
| `GHCR_DEPLOY_TOKEN` | 否 | Repository | 私有 GHCR 才需要 |
| `GHCR_DEPLOY_USER` | 否 | Repository | 配合 PAT |
| **`CD_PUBLIC_API_URL`** | **是**（新 CD） | **Environment production** 或 Repository | 公网 API 基址，如 `https://xingxiaolin.cn` |
| **`CD_SMOKE_PAT`** | 否 | **Environment production** 或 Repository | 黑盒：`/v1/me`、`/v1/today` |

只把 **新增 2 个** 放在 Environment `production` 完全够用；**不必**把 `DEPLOY_*` 搬进 Environment。

若同名 Secret 在 Repository 与 Environment **各有一份**，Environment 会覆盖 Repository——避免重复定义同名键。

`CD_PUBLIC_API_URL` / `CD_SMOKE_PAT` **不要**写入 VPS 的 `.env.production`。

#### B. VPS 生产机 → `apps/api/.env.production`（API 容器运行时）

| 变量 | 必填 | 说明 |
|------|------|------|
| `POSTGRES_PASSWORD` | 是 | 数据库密码 |
| `AI_TODO_ALLOW_DEV_AUTH` | 是 | 必须为 `false` |
| `AI_TODO_WECHAT_APP_ID` | 是 | 小程序 AppID |
| `AI_TODO_WECHAT_APP_SECRET` | 是 | 小程序 AppSecret |
| `AI_TODO_PUBLISH_PORT` | 否 | 默认 `8082`（网关反代目标） |
| `AI_TODO_RELEASE_TAG` / `AI_TODO_GIT_SHA` | 否 | CD 部署时由脚本注入，一般不用手改 |

微信模板 ID、镜像站等见 `apps/api/.env.production.example`。

#### C. xiaolin-gateway（证书 / 域名，与 ai-todo 仓库 Secrets 无关）

证书文件在网关服务器 `app/ai-todo/cert/`，不在 GitHub Secrets 里。

脚本：`scripts/cd/post-deploy-verify.py`、`scripts/cd/write-release-report.mjs`。

`scan-node` 也会运行 `scripts/ci/smoke-deploy-manifest.mjs`，用临时 manifest 覆盖 `write-deploy-manifest.mjs` + `verify-deploy-manifest.mjs`，确保 CI/CD 脚本本身在 PR 阶段就能被发现问题。

## CD 与多环境

| 环境 | GitHub Environment | 触发方式 | Secrets |
|------|-------------------|----------|---------|
| **production** | `production` | 仅手动 workflow_dispatch，选择 production | `DEPLOY_*`、`GHCR_DEPLOY_*` |
| **staging** | `staging` | 仅手动 workflow_dispatch，选择 staging | 在 Environment 中配置独立 `DEPLOY_*` |

API 运行时环境文件按 `.env` → `.env.local/.env.staging/.env.production` 顺序加载，环境专属文件覆盖公共默认值。模板与 `gh secret set --env ...` 示例见 [env/README.md](./env/README.md)。

## Monitor 告警

`.github/workflows/monitor.yml` 每 15 分钟对 production 执行黑盒告警检查，也可手动选择 staging。检查脚本为 `scripts/ops/check-alerts.py`，会验证 `/v1/health`、`/v1/health/db` 与 `/metrics`。详细说明见 [ops-observability.md](./ops-observability.md)。

**手动触发 CD**（workflow_dispatch）时若缺少 secrets，仍会 **失败并提示**，避免误以为已部署。

启用手动 CD 前，在 GitHub **Settings → Secrets and variables → Actions**（仓库级即可；也可放在 Environment `production`）配置：

| Secret | 说明 |
|--------|------|
| `DEPLOY_HOST` | VPS IP 或域名 |
| `DEPLOY_USER` | SSH 用户名（如 `root` / `ubuntu`） |
| `DEPLOY_SSH_KEY` | **SSH 私钥全文**（`-----BEGIN ... PRIVATE KEY-----`），**不是**登录密码 |
| `DEPLOY_PASSWORD` | 可选：若不用密钥，填 SSH **登录密码**（二选一，优先密钥） |
| `DEPLOY_PATH` | 可选：服务器上仓库路径，默认 `$HOME/AgentProjects/ai-todo` |
| `GHCR_DEPLOY_TOKEN` | 可选：自定义拉取 GHCR 镜像的 PAT；未配置时 CD 使用本次 workflow 的短期 `github.token` |

若曾把服务器密码误填进 `DEPLOY_SSH_KEY`，请 **删除该 Secret**，改用 `DEPLOY_PASSWORD` 存密码，或按下方生成专用部署密钥。

**推荐：部署专用 SSH 密钥**（在本地执行一次）：

```bash
ssh-keygen -t ed25519 -C "github-actions-ai-todo" -f ~/.ssh/ai_todo_deploy -N ""
cat ~/.ssh/ai_todo_deploy.pub   # 追加到服务器 ~/.ssh/authorized_keys
# GitHub Secret DEPLOY_SSH_KEY ← 粘贴 ~/.ssh/ai_todo_deploy 私钥全文
```

手动 CD 参数：

- `environment`：`production` / `staging`
- `ci_run_id`：可选。仅在回滚或明确指定某次 CI 时填写；该 CI 必须产出 `deploy-manifest`。
- `release_tag`：日常发布必填，例如 `v0.1.1`。CD 会解析 tag 指向的 commit，并查找该 commit 对应的成功 CI。
- `deploy_mode`：VPS 部署策略（见下表）

日常发布时通常只需要：

1. 在 GitHub Actions 打开 `CD` workflow。
2. 点击 `Run workflow`，`Use workflow from` 选择 `main`（只表示使用最新 CD 工作流定义，不表示部署 main 最新 commit）。
3. `environment=production`，`release_tag=v0.1.1`，`ci_run_id` 留空，`deploy_mode=auto`。
4. CD 会解析 `v0.1.1` 指向的 commit，自动查找该 commit 对应的最新成功 `CI` push run，下载 `deploy-manifest` 并部署。

只有在手动回滚时，才填写要恢复版本对应的旧 `ci_run_id`。

### VPS 部署策略（`deploy_mode`）

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| **auto**（默认） | 先 `docker pull` manifest 中的 digest 镜像；pull 失败则 **自动 server-build** | 手动生产 CD、国内 VPS |
| **pull** | 仅 pull，不兜底 build | 网络稳定、需严格 digest 部署 |
| **server-build** | 跳过 pull，在 VPS `docker compose build`（仍校验 manifest 指纹与 `gitSha`） | GHCR 长期不可达时的明确选择 |

环境变量（CD SSH 脚本或服务器手动部署均可覆盖）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `AI_TODO_DEPLOY_MODE` | `pull` | `pull` / `server-build` |
| `AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD` | `true`（auto 时） | pull 失败后是否 server-build |
| `AI_TODO_HEALTH_WAIT_SECONDS` | `90`（CD）/ `120`（脚本默认） | 启动后等待 health/db 的最长时间 |
| `AI_TODO_PULL_RETRIES` | `2`（CD） | `docker pull` 重试次数 |
| `AI_TODO_PULL_TIMEOUT_SECONDS` | `180`（CD） | 单次 pull 最长秒数（`timeout` 命令） |
| `AI_TODO_PULL_SKIP_CANONICAL_FALLBACK` | `true`（CD） | 镜像站失败后是否跳过慢速 `ghcr.io` |
| `AI_TODO_PULL_REGISTRY_MIRROR` | `ghcr.nju.edu.cn`（CD + 脚本默认） | public GHCR 的 NJU 加速；`none` 禁用 |

CD workflow SSH **`command_timeout` 为 10m**：镜像站 pull 限时失败后尽快 **server-build**，避免长时间卡在跨境 `ghcr.io`。

**无需为 CD 单独改 `.env.production`**：workflow 会通过 SSH 注入 `AI_TODO_PULL_REGISTRY_MIRROR=ghcr.nju.edu.cn` 等变量。仅在 **服务器手动** 执行 `remote-deploy.sh` / `deploy-from-manifest.sh` 且不走 CD 时，才建议在 `.env.production` 写上镜像站（或不写，使用脚本默认 `ghcr.nju.edu.cn`）。

CD SSH 仅做 `git pull` 后执行 `apps/api/deploy/cd-bootstrap.sh`（bash 脚本，含 `case` 与 NJU 镜像默认值）。勿在 workflow 内联 `case … esac`：VPS 默认 **zsh** 或 YAML 缩进会导致 `parse error near ';'`。

`.deploy/current.json` 会记录 `deployMode`：`pull`、`server-build` 或 `server-build-fallback`，回滚时按上一模式的策略恢复。

### 镜像拉取与 server-build 误判

经 NJU 等镜像站拉取并 `docker tag` 到 `ghcr.io/...@sha256:…` 后，`RepoDigests` 可能**不含** `ghcr.io` 前缀，旧逻辑会判定 digest 校验失败并误触发 **server-build-fallback**。现改为：

- 按 `sha256:<hex>` 匹配任意 `RepoDigests` 条目；
- 若 `RepoDigests` 为空但 ref 为 digest-pinned，则信任本地镜像；
- 本地已有目标 digest 时**跳过 pull**，避免重复拉取后仍 fallback。
- NJU 拉取成功后 **不能** `docker tag` 两个 `@sha256:` 互指；compose 改用 **镜像站同名 digest**（`ghcr.nju.edu.cn/...`），与 manifest digest 一致。

### 部署脚本与 Python 版本

VPS 上 `deploy-from-manifest.sh` 等通过 **`/usr/bin/python3`** 写 `.deploy/*.json`。若系统为 **Python 3.10**，须使用 `timezone.utc`（已修复）；**不要**依赖 3.11 的 `datetime.UTC`。API **容器内**仍为 Python 3.11（见 Dockerfile）。

配置如何进入 API 容器（与 CD 环境变量区别）见 [deploy.md](./deploy.md#配置如何进入-api-容器)。

**已遇到问题汇总（现象 / 原因 / 修复 / 预防）**：[deploy-troubleshooting.md](./deploy-troubleshooting.md)。

### VPS 磁盘：API 镜像保留与清理

| 机制 | 说明 |
|------|------|
| `.deploy/image-retention.json` | 每次部署成功记录最近 N 个 `api` digest（默认 **3**） |
| `deploy/prune-container-images.sh` | 删除不在保留列表中的 `ai-todo-api` 镜像（跳过正在运行的容器） |
| `docker image prune -f` | 清理 dangling 层 |

环境变量：`AI_TODO_IMAGE_RETENTION`（默认 3）。**不**清理 `postgres:16-alpine` 等其它镜像。

### server-build 时的 apt 加速

VPS `docker compose build` 通过 `APT_MIRROR`（`docker-compose.prod.yml` 默认 `mirrors.tencent.com`）替换 Debian 源；CI 构建镜像不传该参数，仍用官方源。

## 私有 GitHub 仓库 + 公开 GHCR 包

**可以。** 代码仓库可见性与容器包可见性是分开的：

| 资源 | 推荐设置 | 说明 |
|------|----------|------|
| GitHub 仓库 `ai-todo` | **Private** | 源码与 Actions 日志仍受仓库权限保护 |
| GHCR 包 `ghcr.io/<owner>/ai-todo-api` | **Public** | VPS 可匿名或弱认证拉取；可选用 [NJU GHCR 镜像](https://doc.nju.edu.cn/books/e1654/page/ghcr) 加速 |

将容器包改为 Public 的步骤（需包 Owner 权限）：

1. 打开 `https://github.com/users/<owner>/packages/container/ai-todo-api/settings`
2. **Change visibility** → **Public**
3. （可选）手动部署时在 VPS `.env.production` 设置 `AI_TODO_PULL_REGISTRY_MIRROR=ghcr.nju.edu.cn`；**CD 已自动注入，不必改**

注意：

- CI 仍用 `GITHUB_TOKEN` **push** 镜像（需 `packages: write`），与 VPS **pull** 权限无关。
- 公开包意味着他人可 `docker pull` 该镜像（通常可接受运行时镜像；**Secrets 仍在 `.env.production`，不在镜像内**）。
- 若保持 GHCR **Private**，VPS 仍需 `GHCR_DEPLOY_TOKEN`（`read:packages` PAT）或 CD 传入的 token；**无法**使用 NJU 等公共缓存站。

## VPS 前置条件（CD 路径）

1. 仓库 clone 路径与 `DEPLOY_PATH` 一致  
2. `.env.production` 已配置  
3. **GHCR 拉取**（`deploy_mode` 为 `pull` / `auto` 时）  
   - 公开包：可不配置 `GHCR_DEPLOY_TOKEN`（建议仍配置以应对 rate limit）  
   - 私有包：`GHCR_DEPLOY_TOKEN`（`read:packages` PAT）+ 可选 `GHCR_DEPLOY_USER`  
4. Docker Compose ≥ 2.20（支持 `image` + `--no-build` 部署）

### 国内 VPS：GHCR 拉取（可选镜像加速）

默认 **直连 `ghcr.io`**。manifest 与 `.deploy/current.json` 始终记录 canonical 地址 `ghcr.io/...@sha256:...`。

| 配置 | 说明 |
|------|------|
| （默认，留空） | 私有 GHCR：`docker login ghcr.io` 后按 manifest digest pull |
| `AI_TODO_PULL_REGISTRY_MIRROR=ghcr.nju.edu.cn` | 仅适用于 **public** GHCR 包 |

参考：[NJU GHCR 镜像说明](https://doc.nju.edu.cn/books/e1654/page/ghcr)

部署入口：`apps/api/deploy/remote-deploy.sh`  
- CD 进入 `DEPLOY_PATH` 后会先 `git pull --ff-only origin main`，确保服务器部署脚本与 GitHub `main` 一致；若服务器目录有分叉或无法快进，会失败并停止部署。
- 设置 `AI_TODO_DEPLOY_MANIFEST` → `deploy-from-manifest.sh`（默认 pull；失败可 fallback server-build）  
- 未设置 manifest → 本地应急 `docker compose up -d --build`

manifest 部署路径会在远端执行这些硬性检查：

- `python3` 与 `docker compose` 可用
- `.env.production` 存在
- `AI_TODO_ALLOW_DEV_AUTH=false`
- `AI_TODO_WECHAT_APP_ID` / `AI_TODO_WECHAT_APP_SECRET` 已填写
- `/v1/health` 可访问
- `/v1/health/db` 返回 `status: ok`、`identitiesTable: true`、`usersHasUsername: true`

部署成功后，服务器仓库目录会写入 `.deploy/current.json`，记录当前 `gitSha`、API 镜像 digest、manifest fingerprint、CI run id 和部署时间，便于排查线上实际版本。

### 回滚路径

manifest 部署会在替换 API 后**轮询** `/v1/health` 与 `/v1/health/db`（默认最多 120s，等待迁移完成）。若新版本启动或健康检查失败，脚本会读取部署前的 `.deploy/current.json`，自动执行应用层回滚：

1. `git reset --hard <previous gitSha>`
2. 按上一版 `deployMode` 恢复：`pull` → 重新 pull digest；`server-build*` → `compose build`
3. 重新执行 health/db 检查
4. 成功后把 `.deploy/current.json` 写成 `status: rolled_back`

这个回滚恢复的是**应用代码 + 容器镜像**，不会回滚 PostgreSQL volume 内已经执行过的数据库迁移。因此数据库变更必须遵守向前兼容迁移：先 expand，再 deploy/backfill，最后 contract。破坏性 schema 变更不能和应用发布绑在一次不可回滚的部署里。

数据库迁移规范见 [database-migrations.md](./database-migrations.md)。CI 的 `scan-api` 会运行 `apps/api/scripts/check_alembic_migrations.py`，阻止基线之后新增 migration 直接包含删表、删列、改非空、改类型等高风险操作。
生产 PostgreSQL volume 的备份、恢复和迁移操作见 [ops-postgresql-data.md](./ops-postgresql-data.md)。

手动回滚方式：触发 `CD` workflow，并传入要恢复的旧 `ci_run_id`。CD 会下载该次 CI 的 `deploy-manifest`，校验 fingerprint 后按旧镜像 digest 部署。只有在 GitHub Actions 不可用时，才使用服务器上的本地应急部署。

## Node.js 24（Actions 运行时）

工作流设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`，项目 Node 使用 **24**。官方 actions 也固定到 Node 24 runtime 版本：

- `actions/checkout@v5`
- `actions/setup-node@v5`
- `actions/setup-python@v6`
- `actions/upload-artifact@v6`
- `actions/download-artifact@v7`
- `pnpm/action-setup@v5`
- `docker/login-action@v4`
- `docker/build-push-action@v7`

如果 Actions 日志再次出现 Node.js 20 弃用告警，优先检查是否引入了仍使用 Node 20 的第三方 action。

## 为何不用 `.github/actions/`？

此前 `setup-node-pnpm` composite action 仅为复用 `pnpm install`。流水线拆细后各 job 步骤不同，**内联 `pnpm/action-setup` + `setup-node` 更清晰**，已删除该 composite action。

若未来多个工作流需要完全相同步骤，可再提取为 [reusable workflow](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)（比 composite 更适合跨工作流共享）。

## 本地对照命令

```bash
# 等同 CI scan + build + test
pnpm typecheck && pnpm lint && pnpm typecheck:wechat && pnpm check:wechat
cd apps/api && python3 -m ruff check src tests && python3 -m pytest -q
cd apps/api && python3 scripts/check_alembic_migrations.py
pnpm --filter "./packages/*" --filter "@xiaolinstar/ai-todo-cli" -r build
pnpm build:wechat:check

# manifest 工具自检
node scripts/ci/smoke-deploy-manifest.mjs
```
