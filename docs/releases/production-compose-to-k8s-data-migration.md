# Production 数据迁移：Compose → K8s（124 → 111）

日期：2026-07-07  
状态：**草案** — 执行前需维护窗口与回滚确认  
关联：[ops-postgresql-data.md](../ops-postgresql-data.md)、[deploy-kubernetes.md](../deploy-kubernetes.md)、[database-migrations.md](../database-migrations.md)

## 范围

| 角色                 | 主机             | 运行方式                   | 数据库                                                               |
| -------------------- | ---------------- | -------------------------- | -------------------------------------------------------------------- |
| **源端（旧生产）**   | `124.222.98.227` | Docker Compose             | volume `ai-todo-production_ai_todo_postgres_data`（或旧名 `api_`\*） |
| **目标端（新生产）** | `111.229.38.208` | k3s · overlay `production` | PVC `postgres-pvc` · namespace `ai-todo`                             |

**本次只做数据迁移**，不包含 Gateway 切流（切流见文末「切流与双中心」）。  
**不做** Alembic downgrade；schema 以源库当前 `alembic_version` 为准，目标 API 镜像应 **≥ 源端已部署版本**。

## 原则

1. **先备份、再停写、再导出、再导入、再验证**。
2. 源端与目标端 **Postgres 用户/库名** 保持一致（默认 `ai_todo` / `ai_todo`）。
3. 目标 K8s Secret `.env.production.secrets` 里 `POSTGRES_PASSWORD` **必须与源库一致**（否则恢复后 API 连不上；改密需另做 runbook）。
4. 111 若已有空库/测试数据，导入前需 **清空或重建** 目标库（见步骤 4）。
5. 迁移完成后 **不要** 对 124 执行 `docker compose down -v`。

### kubectl exec 写法（必读）

`kubectl exec ... --` 后面的 **整条命令必须写在同一行**（或 `--` 与 `psql` 之间 **不要** 用 `\` 换行）。

错误示例（zsh/bash 会把 `\` 后的换行当作「命令续行」，**`psql` 在宿主机执行**，不在容器内）：

```bash
# ❌ 错误 — 常见报错：exec: " ": executable file not found；或本机 psql: command not found
kubectl exec -it -n ai-todo deployment/postgres -- \
  psql -U ai_todo -d ai_todo -c "SELECT 1;"
```

正确示例：

```bash
# ✅ 单条 SQL（非交互，不必加 -t）
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "SELECT version_num FROM alembic_version;"

# ✅ 从本机 stdin 导入（必须 -i，且整行一条）
kubectl exec -i -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo < ~/ai-todo-production-migration.sql
```

---

## 0. 前置检查（两台机器各做）

### 0.1 源端 124 — 确认 Compose 与数据

```bash
ssh ubuntu@124.222.98.227
cd ~/AgentProjects/ai-todo/apps/api

# 项目名以 .env.production 为准
grep AI_TODO_COMPOSE_PROJECT_NAME .env.production || true

# Postgres 在跑
COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml ps postgres

# 当前 Alembic 版本（记录到迁移记录表）
COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U ai_todo -d ai_todo -c "SELECT version_num FROM alembic_version;"

# 粗算行数（可选，迁移后对照）
COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U ai_todo -d ai_todo -c "\dt"
```

记下：`version_num`、Compose project 名、API 当前 `gitSha`（`curl -sf http://127.0.0.1:8082/v1/health`）。

### 0.2 目标端 111 — 确认 K8s 与密钥

```bash
ssh ubuntu@111.229.38.208
export KUBECONFIG=~/.kube/config

kubectl get pods,svc,pvc -n ai-todo
ls -la ~/AgentProjects/ai-todo/apps/api/deploy/k8s/overlays/production/.env.production.secrets

# 目标 API 版本应不低于源端（避免 schema 比数据旧）
curl -fsS http://127.0.0.1:30082/v1/health || true
```

确认 `POSTGRES_PASSWORD` 与 124 的 `.env.production` **相同**（若 111 是空库初始化用的另一套密码，导入前改 secrets 并 `kubectl apply -k`，或导入后统一改密——不推荐在迁移窗口做）。

### 0.3 镜像与 manifest

目标集群 API 镜像 digest **≥ 源端线上版本**（含 migration 文件）。  
推荐：在 111 上先跑一次 **CD (K8s)** 或手动 pin 与 124 相同的 manifest digest，再导数据。

---

## 1. 维护窗口与停写（124）

**目标：导出时无业务写入。**

1. 公告/低峰时段（建议 15–30 分钟窗口）。
2. **不要先切 Gateway**；仍由 124 对外，直到 111 验证通过。
3. 停 124 应用容器，**保留 Postgres**：

```bash
# 在 124
cd ~/AgentProjects/ai-todo/apps/api

COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml stop api

# 若 worker 在跑（notifications profile）
COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml --profile notifications stop worker

# 确认 postgres 仍 Up
COMPOSE_ENCOMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml psV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml ps
```

1. （可选）公网只读：在 Gateway 返回 503，或仅内网验证——按你方运维习惯。

---

## 2. 源端全量备份（124）

```bash
BACKUP="/tmp/ai-todo-production-$(date +%Y%m%d-%H%M%S).sql"

COMPOSE_ENV_FILES=.env,.env.production \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" --no-owner --no-acl' \
  > "$BACKUP"

ls -lh "$BACKUP"
# 建议校验非空
wc -l "$BACKUP"
head -20 "$BACKUP"
```

**第二份拷贝**到本机或对象存储（不要只留 `/tmp`）：

```bash
# 在 124 上，复制到 home 并限制权限
cp "$BACKUP" ~/ai-todo-production-migration.sql
chmod 600 ~/ai-todo-production-migration.sql
```

---

## 3. 传输 dump 到 111

```bash
# 在 124 或本机执行（示例：124 → 111）
scp ~/ai-todo-production-migration.sql \
  ubuntu@111.229.38.208:~/ai-todo-production-migration.sql
```

大库可 `gzip` 后传输；111 上 `gunzip` 再导入。

---

## 4. 目标端准备（111）

### 4.1 缩容应用（**必须**，含 worker）

导入期间 **api 与 worker 都必须为 0**。Worker 探针会对 DB 执行 `SELECT 1`；`DROP SCHEMA` 或 `psql` 导入时库不可用 → 探针失败 → **CrashLoopBackOff**（看起来像「worker/数据库崩溃」，多为预期现象）。

```bash
kubectl scale deployment/api -n ai-todo --replicas=0
kubectl scale deployment/worker -n ai-todo --replicas=0
kubectl wait --for=delete pod -l app.kubernetes.io/name=ai-todo-api -n ai-todo --timeout=120s || true
kubectl wait --for=delete pod -l app.kubernetes.io/name=ai-todo-worker -n ai-todo --timeout=120s || true

# 确认无 api/worker Pod
kubectl get pods -n ai-todo
# 此时应只剩 postgres Running
```

> **勿**在步骤 5 完成、§5 验证通过前把 worker 扩回 1。

### 4.2 若 111 已有空库 / 测试数据 — 清空

**111 首次部署若是空库**，Postgres 里可能只有空 schema；可直接导入覆盖。  
若已有脏数据，在 **postgres Pod** 内重建 public schema：

```bash
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 若需 extensions（按项目实际）
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

> **极端情况**：PVC 完全不可信 → 删 PVC 重建（会丢 111 本地数据）。仅当 111 无有价值数据时使用；`kubectl delete pvc postgres-pvc -n ai-todo` 后重新 `kubectl apply -k`。

### 4.3 等待 Postgres Ready

```bash
kubectl rollout status deployment/postgres -n ai-todo --timeout=180s
```

---

## 5. 导入数据（111）

```bash
# 在 111（整行一条，见上文「kubectl exec 写法」）
kubectl exec -i -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo < ~/ai-todo-production-migration.sql
```

验证：

```bash
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "SELECT version_num FROM alembic_version;"

# 与 124 步骤 0.1 记录的 version_num 一致
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "SELECT COUNT(*) FROM users;"
# 及其他关键表…
```

---

## 6. 启动 K8s 应用

**顺序：先 API，验收通过后再 Worker。**

```bash
cd ~/AgentProjects/ai-todo/apps/api/deploy/k8s/overlays/production
kubectl apply -k .

kubectl scale deployment/api -n ai-todo --replicas=1
kubectl rollout status deployment/api -n ai-todo --timeout=300s
```

本机探活（**必须通过再启 worker**）：

```bash
curl -fsS http://127.0.0.1:30082/v1/health
curl -fsS http://127.0.0.1:30082/v1/health/db
```

Worker（可选；无 `AI_TODO_WECHAT_REMINDER_TEMPLATE_ID` 时保持 0）：

```bash
kubectl scale deployment/worker -n ai-todo --replicas=1
# 或：kubectl scale deployment/worker -n ai-todo --replicas=0

kubectl rollout status deployment/worker -n ai-todo --timeout=180s
```

---

## 7. 验收清单

| 检查项        | 命令 / 方式                      | 期望                                     |
| ------------- | -------------------------------- | ---------------------------------------- |
| Alembic 版本  | 124/111 `alembic_version`        | 一致                                     |
| 用户/待办抽样 | SQL count 或小程序/CLI           | 与迁移前快照一致                         |
| DB 深度       | `GET /v1/health/db`              | `status: ok`，`identitiesTable: true` 等 |
| API           | `GET /v1/health`                 | `gitSha` 为预期 digest 对应 commit       |
| Worker        | `kubectl logs deployment/worker` | 无持续 crash（若 replicas>0）            |

---

## 8. Gateway 切流与 124 处置

**仅在 111 本机与内网验收通过后：**

1. xiaolin-gateway：`xingxiaolin.cn` 上游 **124:8082 → 111:30082**（或经 gateway 本机反代）。
2. 公网：

```bash
curl -fsS https://xingxiaolin.cn/v1/health
curl -fsS https://xingxiaolin.cn/v1/health/db
```

1. **124 Compose**：保持 Postgres volume **不删**；api/worker 保持停止或缩容，作为 **只读回退** 至少 7 天。
2. 后续发版走 **CD (K8s)** + Environment `production-k8s`；**勿**再对 124 触发 Compose `production` CD。

### 回滚（切流前）

- 未切 Gateway：恢复 124 `docker compose start api`，无需动 111。
- 已切 Gateway 且 111 异常：Gateway 指回 124，启动 124 api；111 可暂留排查。

### 回滚（切流后）

- Gateway 指回 124 + 启动 124 api（数据仍以 **124 停写前的备份** 为准；切流后在 111 产生的写入不会自动回到 124）。
- 因此切流前务必完成 124 最终 dump，并确认停写窗口内无漏写。

---

## 9. 与未来「多中心」的关系

| 层级             | 124 + 111 过渡态                 | 未来多中心                                                             |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------- |
| **API / Worker** | 111 K8s 主；124 备用             | 多集群同镜像 digest，Gateway 权重/地域                                 |
| **PostgreSQL**   | **单主库**（迁移后只在 111 PVC） | 应改为 **单一写库**（托管 RDS 或明确主从）；**不要** 两中心各写各的 PG |
| **Schema 迁移**  | API 启动 Alembic                 | 仍只在一处执行 `upgrade head`（Job 或单主 API）                        |
| **数据迁移**     | 本次 pg_dump 一次性              | 跨中心用复制/备份恢复，不是日常 CD                                     |

结论：**无状态 Pod 可以多中心；数据库不能按同样频率「换 digest 就 rollout」**。多中心前需先定 **一个写库真源**，111/124 只分担读流量或灾备，除非上 PG 流复制。

---

## 附录 A：迁移中 Worker / Postgres「崩溃」应急

### 现象

- `worker` 为 `CrashLoopBackOff`
- 或 `postgres` 短暂 `Error` / 重启

### 常见原因

| 原因              | 说明                                                            |
| ----------------- | --------------------------------------------------------------- |
| **未缩容 worker** | 导入 / `DROP SCHEMA` 时 DB 不可用，liveness `SELECT 1` 失败     |
| **导入未完成**    | 半库状态下误启 api/worker                                       |
| **Postgres 压力** | 大 dump 导入时 CPU/内存高（见 `kubectl describe pod postgres`） |
| **密码不一致**    | `.env.production.secrets` 与源库密码不同                        |

Worker **不跑** Alembic；崩溃几乎都是 **连不上库** 或 **schema 不完整**。

### 立即处理（111）

```bash
kubectl scale deployment/worker -n ai-todo --replicas=0
kubectl scale deployment/api -n ai-todo --replicas=0

kubectl get pods -n ai-todo
kubectl logs deployment/postgres -n ai-todo --tail=50

kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "SELECT 1; SELECT version_num FROM alembic_version;"
```

- **上面 psql 失败** → worker/api 保持 0，按 §4.2 **清库重导** dump
- **psql 成功** → 只启 API，`/v1/health/db` 通过后再决定是否启 worker（不需要微信推送可长期 `replicas=0`）

### Postgres 自身 CrashLoopBackOff

查 `kubectl describe pod` 是否 **OOMKilled**；导入期间 **保持 api/worker=0**，稳定后再重导。

---

## 附录 B：alembic_version 不一致

| 111 vs dump            | 处理                             |
| ---------------------- | -------------------------------- |
| 111 **更高**           | 曾空库启过 API → **清库重导**    |
| 111 **更低**、数据不全 | **清库重导**                     |
| 111 **更低**、数据齐全 | 启 API 后 `alembic upgrade head` |

```bash
grep alembic_version ~/ai-todo-production-migration.sql | head -5
kubectl exec -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo -c "SELECT version_num FROM alembic_version;"
```

---

## 10. 执行记录（现场填写）

| 项                     | 值  |
| ---------------------- | --- |
| 维护窗口开始           |     |
| 124 停写时间           |     |
| dump 文件路径 / 大小   |     |
| 源 `alembic_version`   |     |
| 目标 `alembic_version` |     |
| 111 验收通过时间       |     |
| Gateway 切换时间       |     |
| 操作人                 |     |

---

## 相关命令速查

```bash
# 124 备份
COMPOSE_ENV_FILES=.env,.env.production docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ai_todo ai_todo --no-owner --no-acl > backup.sql

# 111 导入
kubectl exec -i -n ai-todo deployment/postgres -- psql -U ai_todo -d ai_todo < backup.sql

# 111 本机健康
curl -fsS http://127.0.0.1:30082/v1/health/db
```
