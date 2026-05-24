# CI / CD 流水线

## 工作流一览

| 工作流 | 文件 | 触发 | 职责 |
|--------|------|------|------|
| **CI** | `.github/workflows/ci.yml` | push / PR → `main` | 扫描 → 构建 → 测试 → 发布制品清单 |
| **CD** | `.github/workflows/cd.yml` | `main` 上 CI 成功；或手动 | 校验指纹 → 拉取 CI 镜像部署（不在 VPS 上 build） |

CI 与 CD 通过 **`deploy-manifest.json` 制品 + `sha256` 指纹** 关联，而不是仅靠「上一次 CI 成功」的逻辑约定。

## CI 阶段（细粒度 Job）

```text
Phase 1 · scan (并行)
  scan-node      → pnpm typecheck / lint
  scan-miniapp   → typecheck + 目录结构
  scan-api       → ruff

Phase 2 · build (并行，依赖对应 scan)
  build-node     → pnpm build (packages + cli)
  build-miniapp  → 上传 artifact: miniapp-dist
  build-api-image → 构建并 push GHCR 镜像 (main)；PR 仅验证 build

Phase 3 · test
  test-api       → pytest

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

## CD 与多环境

| 环境 | GitHub Environment | 触发方式 | Secrets |
|------|-------------------|----------|---------|
| **production** | `production` | `main` CI 成功后自动；或手动选 production | `DEPLOY_*`、`GHCR_DEPLOY_*` |
| **staging** | `staging` | 仅手动 workflow_dispatch，选择 staging | 在 Environment 中配置独立 `DEPLOY_*` |

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
- 设置 `AI_TODO_DEPLOY_MANIFEST` → `deploy-from-manifest.sh`（拉 CI 镜像，**不** `--build`）  
- 未设置 → 本地应急 `docker compose up -d --build`

## Node.js 24（Actions 运行时）

工作流设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`，项目 Node 使用 **24**（消除 Actions Node 20 弃用警告）。

## 为何不用 `.github/actions/`？

此前 `setup-node-pnpm` composite action 仅为复用 `pnpm install`。流水线拆细后各 job 步骤不同，**内联 `pnpm/action-setup` + `setup-node` 更清晰**，已删除该 composite action。

若未来多个工作流需要完全相同步骤，可再提取为 [reusable workflow](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)（比 composite 更适合跨工作流共享）。

## 本地对照命令

```bash
# 等同 CI scan + build + test
pnpm typecheck && pnpm lint && pnpm typecheck:wechat && pnpm check:wechat
cd apps/api && python3 -m ruff check src tests && python3 -m pytest -q
pnpm --filter "./packages/*" --filter "@ai-todo/cli" -r build
pnpm build:wechat
```
