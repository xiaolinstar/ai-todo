# CI / CD 流水线

## 工作流一览

| 工作流 | 文件 | 触发 | 职责 |
|--------|------|------|------|
| **CI** | `.github/workflows/ci.yml` | push / PR → `main` | 扫描 → 构建 → 测试 → 发布制品清单 |
| **CD** | `.github/workflows/cd.yml` | `main` 上 CI 成功；或手动 | 校验指纹 → 拉取 CI 镜像部署（不在 VPS 上 build） |

CI 与 CD 通过 **`deploy-manifest.json` 制品 + `sha256` 指纹** 关联，而不是仅靠「上一次 CI 成功」的逻辑约定。

## 当前发布现状

当前采用 **特性分支开发、PR 门禁、main 发布**：

```text
本地 feature 分支
  → push 到 GitHub
  → 创建 PR 到 main
  → PR 只跑 CI：质量检查、构建验证、测试，不部署
  → PR 通过后 merge 到 main
  → main push 跑 CI：生成不可变镜像与 deploy-manifest
  → main CI 成功后自动触发 CD：按 manifest 部署生产
```

PR 的作用是把一次变更放进可审查流程里：人工 review 看设计和风险，GitHub Actions 做自动质量门禁，PR 页面保留讨论、CI 结果和合并记录。PR 编号来自 GitHub，例如 `/pull/1` 中的 `1`；也可以用 `gh pr view --json number,url` 查看。

`gh pr merge <PR_NUMBER> --squash` 的作用是让 GitHub 在远端把 PR 合并进 `main`。合并后远端 `main` 产生新 commit，从而触发 main CI/CD。本地开发者随后执行：

```bash
git switch main
git pull origin main
```

开发者日常需要关注：

- PR 上 CI 是否全绿；不绿不要 merge。
- main 上 CI 是否生成了 `deploy-manifest`。
- main CI 成功后 CD 是否完成部署，或因 secrets 未配置而明确跳过。
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
| `miniapp-dist` | `build-miniapp` | 小程序构建产物 tarball + sha256 |
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

CD 部署前会执行 `scripts/ci/verify-deploy-manifest.mjs` 校验指纹未被篡改。

`cd.yml` 需 `permissions.actions: read`，以便 `workflow_run` 触发的 CD 能下载 CI 上传的 `deploy-manifest` 制品。

`scan-node` 也会用一份临时 manifest 跑 `write-deploy-manifest.mjs` + `verify-deploy-manifest.mjs`，确保 CI/CD 脚本本身在 PR 阶段就能被发现问题。

## CD 与多环境

| 环境 | GitHub Environment | 触发方式 | Secrets |
|------|-------------------|----------|---------|
| **production** | `production` | `main` CI 成功后自动；或手动 | `DEPLOY_*`、`GHCR_DEPLOY_*` |
| **staging** | `staging` | 仅手动 workflow_dispatch，选择 staging | 在 Environment 中配置独立 `DEPLOY_*` |

**未配置 `DEPLOY_*` 时**：CI 成功后的自动 CD **会跳过部署**（workflow 显示成功，并输出 notice），不会把整条流水线标红。当前若仍用手动 `docker compose` 发布，这是预期行为。

**手动触发 CD**（workflow_dispatch）时若缺少 secrets，仍会 **失败并提示**，避免误以为已部署。

启用自动 CD 前，在 GitHub **Settings → Secrets and variables → Actions**（仓库级即可；也可放在 Environment `production`）配置：

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
- `ci_run_id`：指定某次 CI 的 run id（默认自动部署时使用触发 CD 的那次 CI run）

## VPS 前置条件（CD 路径）

1. 仓库 clone 路径与 `DEPLOY_PATH` 一致  
2. `.env.production` 已配置  
3. **GHCR 拉取权限**（二选一）  
   - GitHub Environment secret：`GHCR_DEPLOY_TOKEN`（推荐 read:packages PAT）+ 可选 `GHCR_DEPLOY_USER`  
   - 或将 `ghcr.io/xiaolinstar/ai-todo-api` 设为 public package  
4. Docker Compose ≥ 2.20（支持 `image` + `--no-build` 部署）

部署入口：`apps/api/deploy/remote-deploy.sh`  
- CD 进入 `DEPLOY_PATH` 后会先 `git pull --ff-only origin main`，确保服务器部署脚本与 GitHub `main` 一致；若服务器目录有分叉或无法快进，会失败并停止部署。
- 设置 `AI_TODO_DEPLOY_MANIFEST` → `deploy-from-manifest.sh`（拉 CI 镜像，**不** `--build`）  
- 未设置 → 本地应急 `docker compose up -d --build`

manifest 部署路径会在远端执行这些硬性检查：

- `python3` 与 `docker compose` 可用
- `.env.production` 存在
- `AI_TODO_ALLOW_DEV_AUTH=false`
- `AI_TODO_WECHAT_APP_ID` / `AI_TODO_WECHAT_APP_SECRET` 已填写
- `/v1/health` 可访问
- `/v1/health/db` 返回 `status: ok`、`identitiesTable: true`、`usersHasUsername: true`

部署成功后，服务器仓库目录会写入 `.deploy/current.json`，记录当前 `gitSha`、API 镜像 digest、manifest fingerprint、CI run id 和部署时间，便于排查线上实际版本。

### 回滚路径

manifest 部署会在替换 API 后执行 `/v1/health` 与 `/v1/health/db` 检查。若新版本启动或健康检查失败，脚本会读取部署前的 `.deploy/current.json`，自动执行应用层回滚：

1. `git reset --hard <previous gitSha>`
2. 使用上一版 `apiImage` digest 重新 `docker compose pull/up`
3. 重新执行 health/db 检查
4. 成功后把 `.deploy/current.json` 写成 `status: rolled_back`

这个回滚恢复的是**应用代码 + 容器镜像**，不会回滚 PostgreSQL volume 内已经执行过的数据库迁移。因此数据库变更必须遵守向前兼容迁移：先 expand，再 deploy/backfill，最后 contract。破坏性 schema 变更不能和应用发布绑在一次不可回滚的部署里。

数据库迁移规范见 [database-migrations.md](./database-migrations.md)。CI 的 `scan-api` 会运行 `apps/api/scripts/check_alembic_migrations.py`，阻止基线之后新增 migration 直接包含删表、删列、改非空、改类型等高风险操作。

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
pnpm --filter "./packages/*" --filter "@ai-todo/cli" -r build
pnpm build:wechat:check

# manifest 工具自检
TMP_DIR="$(mktemp -d)" && cd "$TMP_DIR"
API_IMAGE="ghcr.io/xiaolinstar/ai-todo-api@sha256:0000000000000000000000000000000000000000000000000000000000000000" \
  API_IMAGE_DIGEST="sha256:0000000000000000000000000000000000000000000000000000000000000000" \
  MINIAPP_ARTIFACT_SHA="0000000000000000000000000000000000000000000000000000000000000000" \
  GITHUB_REPOSITORY="xiaolinstar/ai-todo" \
  GITHUB_SHA="0000000000000000000000000000000000000000" \
  GITHUB_REF="refs/heads/main" \
  GITHUB_RUN_ID="0" \
  node /path/to/ai-todo/scripts/ci/write-deploy-manifest.mjs
node /path/to/ai-todo/scripts/ci/verify-deploy-manifest.mjs deploy-manifest.json
```
