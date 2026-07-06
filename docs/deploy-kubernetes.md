# ai-todo Kubernetes 部署

日期：2026-07-06  
状态：**Staging 迁移进行中**；生产仍以 [deploy.md](./deploy.md) 的 Docker Compose 为准。

本文只维护 **Kustomize 清单** 与 **显式 `kubectl` 命令**。不封装 shell 部署脚本——每一步在终端里可见、可审计。

## 原则

- **应用清单**：`kubectl apply -k <overlay>`
- **预览 diff**：`kubectl diff -k <overlay>` 或 `kubectl kustomize <overlay>`
- **密钥**：overlay 目录下的 `.env.*.secrets` / `.env.*.configs`（gitignore），由 Kustomize `secretGenerator` / `configMapGenerator` 注入
- **发版换镜像**：`kubectl set image` 或 `kustomize edit set image` 后 `kubectl apply -k`
- **CD**：Staging 迁 K8s 期间 **手动** 执行下文命令；GitHub CD 仍走 Compose（`deploy-from-manifest.sh`），待 Staging 稳定后再把 CD job 改成几条 kubectl 命令

## 架构对照

```text
小程序 / 探针
  → https://staging.xingxiaolin.cn
  → xiaolin-gateway
  → 宿主机 NodePort 30083 (staging K8s)  或  :8083 (Compose，迁移前)
  → Service api → Pod :3100
  → Service postgres → PVC
  → Deployment worker（按需 0/1 副本）
```

| 环境        | Overlay 路径          | Namespace         | API NodePort  |
| ----------- | --------------------- | ----------------- | ------------- |
| local       | `overlays/local`      | `ai-todo`         | LB `8082`     |
| **staging** | `overlays/staging`    | `ai-todo-staging` | **30083**     |
| production  | `overlays/production` | `ai-todo`         | 30082（草案） |

清单根目录：`apps/api/deploy/k8s/`。

> Gateway：Staging 切 K8s 后，在 [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 把上游 `127.0.0.1:8083` 改为 `127.0.0.1:30083`。

## 组件行为

| 步骤     | API Pod                  | Worker Pod                             |
| -------- | ------------------------ | -------------------------------------- |
| 等数据库 | entrypoint `wait_for_db` | 同左                                   |
| 迁移     | `alembic upgrade head`   | 跳过（`AI_TODO_SKIP_MIGRATIONS=true`） |
| 探针     | `GET /v1/health`         | `worker_healthcheck.py`                |

Worker：base 清单默认 `replicas: 1`。未配置 `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID` 时，部署后执行 `kubectl scale … --replicas=0`（见下文）。

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

### 2. 首次部署

```bash
cd ~/AgentProjects/ai-todo
git pull --rebase

# 建议先 diff，看清将创建/变更什么
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

kubectl exec -i -n ai-todo-staging deployment/postgres -- \
  psql -U ai_todo -d ai_todo < /tmp/ai-todo-staging-backup.sql

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

改 `.env.staging.secrets` 或 `.env.staging.configs` 后：

```bash
kubectl apply -k apps/api/deploy/k8s/overlays/staging
kubectl rollout restart deployment/api deployment/worker -n ai-todo-staging
```

### 6. 更新 API 镜像（发版）

**方式 A — 不改编译进仓库的 kustomization**（推荐，意图最清晰）：

```bash
IMAGE='ghcr.io/xiaolinstar/ai-todo-api@sha256:<digest>'

kubectl set image deployment/api    api=$IMAGE    -n ai-todo-staging
kubectl set image deployment/worker worker=$IMAGE -n ai-todo-staging

kubectl rollout status deployment/api -n ai-todo-staging
```

**方式 B — 写入 overlay 再 apply**：

```bash
cd apps/api/deploy/k8s/overlays/staging
kustomize edit set image ghcr.io/xiaolinstar/ai-todo-api=$IMAGE
kubectl apply -k .
```

发版元数据（`/v1/health` 的 `releaseTag` / `gitSha`）写入 `.env.staging.configs` 后 `kubectl apply -k` 即可。

### 7. 回滚

```bash
kubectl rollout undo deployment/api -n ai-todo-staging
# 或回到指定 revision：
kubectl rollout history deployment/api -n ai-todo-staging
kubectl rollout undo deployment/api --to-revision=<N> -n ai-todo-staging
```

---

## 三、运维速查

```bash
NS=ai-todo-staging

kubectl get pods,svc,pvc -n $NS
kubectl describe pod -n $NS -l app.kubernetes.io/name=ai-todo-api
kubectl logs -n $NS deployment/api -f
kubectl logs -n $NS deployment/worker -f

# 仅渲染 YAML，不应用
kubectl kustomize apps/api/deploy/k8s/overlays/staging

# 删除整个 Staging 栈（危险：PVC 默认保留策略见 base 清单）
kubectl delete -k apps/api/deploy/k8s/overlays/staging
```

---

## 四、与 Compose 差异

| 项       | Compose Staging                | K8s Staging                        |
| -------- | ------------------------------ | ---------------------------------- |
| 隔离     | `AI_TODO_COMPOSE_PROJECT_NAME` | Namespace `ai-todo-staging`        |
| 对外端口 | `8083`                         | NodePort `30083`                   |
| 存储     | Docker volume                  | PVC 2Gi                            |
| Worker   | `--profile notifications`      | `kubectl scale` 控制副本           |
| 部署     | `deploy-from-manifest.sh`      | **`kubectl apply -k`**（当前手动） |

## 五、后续

- **Production K8s**：Staging 浸泡稳定后再做；独立 namespace + Gateway `30082`
- **CD 接 K8s**：在 GitHub Actions SSH 步骤里直接写 `kubectl set image` / `kubectl apply -k`，不必再包一层 shell

## 相关文档

- Compose 部署：[deploy.md](./deploy.md)
- 环境变量：[env/README.md](./env/README.md)
- Staging → Production：[releases/staging-production-promotion.md](./releases/staging-production-promotion.md)
