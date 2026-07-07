# ai-todo Kubernetes 部署

日期：2026-07-07  
状态：**Production 已切 K8s**（111 · `2026-07-07`，见 [production-compose-to-k8s-data-migration.md](./releases/production-compose-to-k8s-data-migration.md)）；Staging 迁移进行中。Production 发版走 GitHub Environment **`production-k8s`** + CD (K8s)。

本文只维护 **Kustomize 清单** 与 **显式 `kubectl` 命令**。不封装 shell 部署脚本——每一步在终端里可见、可审计。

## 部署模型：平台 IaC + 发版 manifest + 部署记录

K8s 路径采用与 Compose CD **同一哲学**的折中方案（非 Full GitOps，但对单节点 k3s 足够）：

| 来源                                          | 管什么                                                                                         | 何时变                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| **Git**（`base/` + `overlays/`）              | 平台配置：Deployment 结构、探针、NodePort、PVC、registry 镜像站前缀、Secret/ConfigMap 引用方式 | 改 infra / 密钥路径时 |
| **deploy-manifest**（CI 制品）                | 发版：本次用哪个 digest、gitSha、fingerprint                                                   | 每次 main CI 成功     |
| **`.deploy/current.json`**（VPS，不提交 git） | **已部署事实**：集群实际在跑哪版                                                               | CD / 手动部署成功后   |

```text
CI  → deploy-manifest.json（这次该用哪个 digest）
CD  → manifest + Git overlay → kustomize edit set image → kubectl apply -k
    → 成功后在 VPS 写 .deploy/current.json
```

**不在 Git 里维护 `newTag` / digest**——镜像版本由 manifest 在部署时注入；Git overlay 只保留静态 infra（如 `ghcr.nju.edu.cn` 镜像站前缀）。

与 Full GitOps 的差距：Git 单独看 overlay **不包含**当前 digest；完整期望状态 = Git + 当次 manifest。后续可选演进：CD bot 自动 commit `image.lock.yaml`，或接入 Argo CD / Flux。

## 原则

- **应用清单**：`kubectl apply -k <overlay>`
- **预览 diff**：`kubectl diff -k <overlay>` 或 `kubectl kustomize <overlay>`
- **密钥**：overlay 目录下的 `.env.*.secrets` / `.env.*.configs`（gitignore），由 Kustomize `secretGenerator` / `configMapGenerator` 注入
- **发版换镜像**：从 CI `deploy-manifest.json` 取 digest → `kustomize edit set image` → `kubectl apply -k`（**不进 Git**）
- **CD**：Staging 迁 K8s 期间 **手动** 执行下文命令；GitHub CD 仍走 Compose（`deploy-from-manifest.sh`），待 Staging 稳定后再把 CD job 改为 manifest 驱动的 kubectl 步骤

## 镜像与 registry

### CI 不 push `:latest`

CI（`.github/workflows/ci.yml`）只 push **`sha-<commit短SHA>`** tag 与 digest，**不存在** `ghcr.io/xiaolinstar/ai-todo-api:latest`。

| 引用形式       | 示例                                          |
| -------------- | --------------------------------------------- |
| SHA tag        | `ghcr.io/xiaolinstar/ai-todo-api:sha-abc1234` |
| Digest（推荐） | `ghcr.io/xiaolinstar/ai-todo-api@sha256:...`  |

发版时从 GitHub Actions → 成功 CI run → Artifacts **`deploy-manifest.json`** 读取 `artifacts.api.image` 或 `artifacts.api.digest`。

### api 与 worker 同镜像

`api` 与 `worker` Deployment 共用同一镜像；Kustomize `images` 块按 `name` 匹配后**一次替换、两边生效**。worker 差异仅在 `args`（跑 notification worker）与 `AI_TODO_SKIP_MIGRATIONS=true`。

### 国内 VPS 使用 NJU 镜像站

overlay 中 `images.newName` 固定为 `ghcr.nju.edu.cn/xiaolinstar/ai-todo-api`（与 Compose CD 默认 `AI_TODO_PULL_REGISTRY_MIRROR` 一致）。**digest 与 GHCR 相同**，仅 registry 前缀不同。

部署时 pin 完整引用示例：

```bash
IMAGE='ghcr.nju.edu.cn/xiaolinstar/ai-todo-api@sha256:<digest>'
```

## 架构对照

```text
小程序 / 探针
  → https://staging.xingxiaolin.cn  或  https://xingxiaolin.cn
  → xiaolin-gateway
  → 宿主机 NodePort 30083 (staging) / 30082 (production)
  → Service api → Pod :3100
  → Service postgres → PVC
  → Deployment worker（按需 0/1 副本）
```

| 环境        | Overlay 路径          | Namespace         | API NodePort |
| ----------- | --------------------- | ----------------- | ------------ |
| local       | `overlays/local`      | `ai-todo`         | LB `8082`    |
| **staging** | `overlays/staging`    | `ai-todo-staging` | **30083**    |
| production  | `overlays/production` | `ai-todo`         | **30082**    |

清单根目录：`apps/api/deploy/k8s/`。

> Gateway：Staging 上游 `127.0.0.1:30083`；Production 上游 `127.0.0.1:30082`（自 Compose `:8082` 切换时改 xiaolin-gateway）。

## 组件行为

| 步骤     | API Pod                  | Worker Pod                             |
| -------- | ------------------------ | -------------------------------------- |
| 等数据库 | entrypoint `wait_for_db` | 同左                                   |
| 迁移     | `alembic upgrade head`   | 跳过（`AI_TODO_SKIP_MIGRATIONS=true`） |
| 探针     | `GET /v1/health`         | `worker_healthcheck.py`                |

Worker：base 清单默认 `replicas: 1`。未配置 `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID` 时，部署后执行 `kubectl scale … --replicas=0`（见下文）。

### `kubectl rollout status` 含义

```bash
kubectl rollout status deployment/postgres -n ai-todo --timeout=180s
```

| 部分                  | 含义                          |
| --------------------- | ----------------------------- |
| `rollout status`      | 阻塞等待 Deployment 就绪      |
| `deployment/postgres` | 资源名                        |
| `-n ai-todo`          | 命名空间                      |
| `--timeout=180s`      | 最多等 180 秒，超时则命令失败 |

Postgres Pod 需通过 readiness probe（`pg_isready`）才算 Ready。通常顺序：先 `postgres`，再 `api`（含迁移），最后 `worker`。

---

## 一、本地联调

```bash
cd apps/api/deploy/k8s/overlays/local

cp env-configs.example .env.local.configs
cp env-secrets.example   .env.local.secrets
# 编辑 .env.local.secrets

# 预览
kubectl kustomize .

# 应用
kubectl apply -k .

# 等待 + 验证
kubectl rollout status deployment/postgres -n ai-todo
kubectl rollout status deployment/api     -n ai-todo
curl -fsS http://127.0.0.1:8082/v1/health
kubectl get pods -n ai-todo
```

日常功能开发仍推荐 `pnpm dev:api`；K8s local 用于验证清单与探针。

---

## 二、Staging 迁移

### 0. 准备集群（VPS）

```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

k3s 单节点自带 **local-path** 存储类，Postgres PVC 自动绑定本地盘。

### 1. 准备 overlay 密钥文件（一次性）

```bash
cd ~/AgentProjects/ai-todo/apps/api/deploy/k8s/overlays/staging

cp env-configs.example .env.staging.configs
cp env-secrets.example   .env.staging.secrets
```

编辑 `.env.staging.secrets`（可从同机 `apps/api/.env.staging` 抄写）：

- `POSTGRES_PASSWORD`
- `AI_TODO_WECHAT_APP_ID` / `AI_TODO_WECHAT_APP_SECRET`
- `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID`（要跑 worker 时）

`.env.staging.configs` 至少保留 `AI_TODO_ENVIRONMENT=staging`、`AI_TODO_ALLOW_DEV_AUTH=false`。

### 2. 首次部署（空库可直启）

```bash
cd ~/AgentProjects/ai-todo
git pull --rebase

# 从 CI deploy-manifest 取 digest，pin 镜像（不进 Git）
cd apps/api/deploy/k8s/overlays/staging
DIGEST='<从 deploy-manifest.json 的 artifacts.api.digest 复制>'
kustomize edit set image \
  "ghcr.nju.edu.cn/xiaolinstar/ai-todo-api=ghcr.nju.edu.cn/xiaolinstar/ai-todo-api@${DIGEST}"

cd ~/AgentProjects/ai-todo
kubectl diff -k apps/api/deploy/k8s/overlays/staging || true
kubectl apply -k apps/api/deploy/k8s/overlays/staging

kubectl rollout status deployment/postgres -n ai-todo-staging --timeout=180s
kubectl rollout status deployment/api     -n ai-todo-staging --timeout=180s
kubectl rollout status deployment/worker  -n ai-todo-staging --timeout=180s
```

无订阅模板时关闭 worker：

```bash
kubectl scale deployment/worker --replicas=0 -n ai-todo-staging
```

验证：

```bash
curl -fsS http://127.0.0.1:30083/v1/health
curl -fsS http://127.0.0.1:30083/v1/health/db
kubectl get pods,svc -n ai-todo-staging
kubectl logs -n ai-todo-staging deployment/api --tail=50
```

### 3. 迁移 Postgres 数据（可选）

```bash
# Compose 导出
cd ~/AgentProjects/ai-todo/apps/api
docker compose -f docker-compose.prod.yml --env-file .env.staging exec -T postgres \
  pg_dump -U ai_todo ai_todo > /tmp/ai-todo-staging-backup.sql

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres \
  -n ai-todo-staging --timeout=180s

kubectl exec -i -n ai-todo-staging deployment/postgres -- psql -U ai_todo -d ai_todo < /tmp/ai-todo-staging-backup.sql

kubectl rollout restart deployment/api -n ai-todo-staging
```

K8s Secret 中的 `POSTGRES_PASSWORD` 须与导出时 Compose 卷内密码一致。

### 4. 切换 Gateway + 停 Compose

Gateway staging 上游 → `127.0.0.1:30083`，然后：

```bash
curl -fsS https://staging.xingxiaolin.cn/v1/health
curl -fsS https://staging.xingxiaolin.cn/healthz
```

确认公网正常后停 Compose（**先不要 `-v`**）：

```bash
cd ~/AgentProjects/ai-todo/apps/api
COMPOSE_ENV_FILES=.env,.env.staging docker compose -f docker-compose.prod.yml down
```

### 5. 更新配置（改密钥 / 非敏感项）

改 `.env.staging.secrets` 或 `.env.staging.configs` 后（**无需改镜像 digest**）：

```bash
kubectl apply -k apps/api/deploy/k8s/overlays/staging
kubectl rollout restart deployment/api deployment/worker -n ai-todo-staging
```

### 6. 更新 API 镜像（发版）

从 CI `deploy-manifest.json` 取 digest，部署时注入（推荐，与 Compose CD 一致）：

```bash
cd ~/AgentProjects/ai-todo/apps/api/deploy/k8s/overlays/staging

DIGEST='<artifacts.api.digest>'
kustomize edit set image \
  "ghcr.nju.edu.cn/xiaolinstar/ai-todo-api=ghcr.nju.edu.cn/xiaolinstar/ai-todo-api@${DIGEST}"

kubectl apply -k .
kubectl rollout status deployment/api     -n ai-todo-staging --timeout=180s
kubectl rollout status deployment/worker  -n ai-todo-staging --timeout=180s
```

发版元数据（`/v1/health` 的 `releaseTag` / `gitSha`）写入 `.env.staging.configs` 后 `kubectl apply -k` 即可。

应急：`kubectl set image` 也可单独更新 api/worker，但长期应与 manifest + `kustomize edit` 流程对齐。

### 7. 回滚

优先用旧 CI 的 `deploy-manifest` 重新 `kustomize edit set image` + `apply`（与 Compose CD 填 `ci_run_id` 同理）。

Deployment 级快速回滚：

```bash
kubectl rollout undo deployment/api -n ai-todo-staging
kubectl rollout history deployment/api -n ai-todo-staging
kubectl rollout undo deployment/api --to-revision=<N> -n ai-todo-staging
```

---

## 三、Production（111 · k3s）

Production overlay：NodePort **30082**、PVC **5Gi**、NJU 镜像站前缀。**2026-07-07** 自 Compose（124）完成数据迁移与 Gateway 切流；124 保留 volume 作回退。完整步骤见 [production-compose-to-k8s-data-migration.md](./releases/production-compose-to-k8s-data-migration.md)。

### 0. 云服务商准备

| 项                  | 说明                                                   |
| ------------------- | ------------------------------------------------------ |
| VPS                 | Ubuntu 22.04+，建议 ≥ 2C / 4GB                         |
| 安全组              | 开放 22、443；**不**开放 30082、5432                   |
| 域名                | `xingxiaolin.cn` 已备案；证书在 xiaolin-gateway        |
| 若已有 Compose 生产 | 已完成迁移；Gateway 上游 `111:30082`；124 勿 `down -v` |

### 1. 安装 k3s + 准备密钥

```bash
curl -sfL https://get.k3s.io | sh -
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
export KUBECONFIG=~/.kube/config

cd ~/AgentProjects/ai-todo/apps/api/deploy/k8s/overlays/production
cp env-secrets.example .env.production.secrets
chmod 600 .env.production.secrets
# 编辑 POSTGRES_PASSWORD、AI_TODO_WECHAT_APP_ID/SECRET
```

Production 当前仅 `secretGenerator`；非敏感默认项在 `base/kustomization.yaml`。若需覆盖 release 元数据等，可参考 staging 增加 `.env.production.configs` + `configMapGenerator merge`。

### 2. 首次部署（空库）

```bash
cd ~/AgentProjects/ai-todo
git pull --rebase

cd apps/api/deploy/k8s/overlays/production
DIGEST='<从 deploy-manifest.json 复制>'
kustomize edit set image \
  "ghcr.nju.edu.cn/xiaolinstar/ai-todo-api=ghcr.nju.edu.cn/xiaolinstar/ai-todo-api@${DIGEST}"

cd ~/AgentProjects/ai-todo
kubectl diff -k apps/api/deploy/k8s/overlays/production || true
kubectl apply -k apps/api/deploy/k8s/overlays/production

kubectl rollout status deployment/postgres -n ai-todo --timeout=180s
kubectl rollout status deployment/api     -n ai-todo --timeout=180s
kubectl rollout status deployment/worker  -n ai-todo --timeout=180s
```

无订阅模板时：

```bash
kubectl scale deployment/worker --replicas=0 -n ai-todo
```

验证：

```bash
curl -fsS http://127.0.0.1:30082/v1/health
curl -fsS http://127.0.0.1:30082/v1/health/db
```

### 3. Gateway + 公网

在 xiaolin-gateway 把 `xingxiaolin.cn` 上游改为 `127.0.0.1:30082`，然后：

```bash
curl -fsS https://xingxiaolin.cn/v1/health
curl -fsS https://xingxiaolin.cn/v1/health/db
```

### 4. 日常变更速查

| 场景              | 操作                                                              |
| ----------------- | ----------------------------------------------------------------- |
| 发新版 API        | manifest digest → `kustomize edit set image` → `kubectl apply -k` |
| 只改密钥          | 改 `.env.production.secrets` → `apply -k` → `rollout restart`     |
| 改 NodePort / PVC | 改 overlay `kustomization.yaml` → `apply -k`                      |
| 查当前版本        | VPS `.deploy/current.json` 或 `GET /v1/health`                    |

---

## 四、运维速查

```bash
# Staging
NS=ai-todo-staging
kubectl get pods,svc,pvc -n $NS
kubectl logs -n $NS deployment/api -f

# Production
NS=ai-todo
kubectl get pods,svc,pvc -n $NS
kubectl describe pod -n $NS -l app.kubernetes.io/name=ai-todo-api

# 仅渲染 YAML，不应用
kubectl kustomize apps/api/deploy/k8s/overlays/staging
kubectl kustomize apps/api/deploy/k8s/overlays/production

# 镜像拉取失败（ImagePullBackOff）
kubectl describe pod -n $NS -l app.kubernetes.io/name=ai-todo-api
# 常见原因：未 kustomize edit pin digest，base 占位 tag 在 registry 不存在

# 删除整个栈（危险：PVC 策略见 base 清单）
kubectl delete -k apps/api/deploy/k8s/overlays/staging
kubectl delete -k apps/api/deploy/k8s/overlays/production
```

---

## 五、与 Compose 差异

| 项              | Compose                        | K8s                                   |
| --------------- | ------------------------------ | ------------------------------------- |
| 隔离            | `AI_TODO_COMPOSE_PROJECT_NAME` | Namespace                             |
| Staging 端口    | `8083`                         | NodePort `30083`                      |
| Production 端口 | `8082`                         | NodePort `30082`                      |
| 存储            | Docker volume                  | PVC（staging 2Gi / production 5Gi）   |
| Worker          | `--profile notifications`      | `kubectl scale` 控制副本              |
| 镜像发版        | manifest → `AI_TODO_API_IMAGE` | manifest → `kustomize edit set image` |
| 部署记录        | `.deploy/current.json`         | 同上（K8s CD 接入后写入）             |

## 六、后续

- **CD 接 K8s**：GitHub Actions SSH 步骤读 manifest → `kustomize edit set image` → `kubectl apply -k` → 写 `.deploy/current.json`
- **Full GitOps（可选）**：Staging 稳定后评估 Flux / Argo CD + 自动 image pin commit

## 相关文档

- Compose 部署：[deploy.md](./deploy.md)
- CI/CD 与 manifest：[ci-cd.md](./ci-cd.md)
- 环境变量：[env/README.md](./env/README.md)
- Staging → Production：[releases/staging-production-promotion.md](./releases/staging-production-promotion.md)
