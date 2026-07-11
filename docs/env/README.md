# Environment Templates

ai-todo uses three runtime environments:

| Environment           | Runtime                          | API env file                               | GitHub Environment |
| --------------------- | -------------------------------- | ------------------------------------------ | ------------------ |
| `local`               | developer machine / local Docker | `apps/api/.env` + `apps/api/.env.local`    | none               |
| `staging`             | VPS + gateway + Docker Compose   | `apps/api/.env` + `apps/api/.env.staging`  | `staging`          |
| `prod` / `production` | VPS + gateway + K8s              | K8s overlay env files / GitHub Environment | `production-k8s`   |

`prod` is the product environment name. Production API currently runs on K8s through GitHub Environment `production-k8s`; `.env.production` and GitHub Environment `production` remain for Compose-era compatibility and fallback documentation.

## Load Order

Project scripts load env files in this order:

```text
apps/api/.env
  → apps/api/.env.local | .env.staging | .env.production
```

The environment-specific file wins when the same key appears in both files.

Keep `apps/api/.env` limited to non-secret defaults. Put secrets in environment-specific files on the target machine or in GitHub Environment secrets.

`docker compose --env-file <file>` replaces the default `.env` lookup. Project scripts therefore set `COMPOSE_ENV_FILES=.env,<environment-file>` internally instead of passing two `--env-file` flags.

## Compose Name

Set `AI_TODO_COMPOSE_PROJECT_NAME` in each environment file to avoid container, network, and volume name collisions on shared VPS hosts:

```env
AI_TODO_COMPOSE_PROJECT_NAME=ai-todo-staging
```

For an existing production deployment, changing this value creates a new Compose project name. Confirm the PostgreSQL volume migration or reuse plan before applying it on the server.

## Templates

| Template                                      | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `apps/api/.env.example`                       | shared non-secret API defaults                                |
| `apps/api/.env.local.example`                 | local Docker overrides and optional local WeChat test secrets |
| `apps/api/.env.staging.example`               | staging VPS overrides and secrets checklist                   |
| `apps/api/.env.production.example`            | production VPS overrides and secrets checklist                |
| `docs/env/github/<env>/variables.env.example` | GitHub Actions Variables（L2）                                |
| `docs/env/github/<env>/secrets.env.example`   | GitHub Actions Secrets（L2）                                  |
| `docs/env/github-environments.md`             | L2 索引与 sync 工作流                                         |
| `docs/env/ops.example.env`                    | local shell variables for CD verification scripts             |

## Health checks (/healthz)

External probes (gateway [uptime.yml](https://github.com/xiaolinstar/xiaolin-gateway/blob/main/.github/workflows/uptime.yml)) use **`GET /healthz`** on the public domain. Canonical spec: [healthz-probe-standard.md](https://github.com/xiaolinstar/xiaolin-gateway/blob/main/docs/healthz-probe-standard.md).

| Purpose           | Path                          |
| ----------------- | ----------------------------- |
| External / uptime | `/healthz` (plain `ok`)       |
| CD / DB depth     | `/v1/health`, `/v1/health/db` |

```bash
curl -fsS https://www.xingxiaolin.cn/healthz
curl -fsS https://staging.xingxiaolin.cn/healthz
```

## Commands

Local Docker:

```bash
cd apps/api
cp .env.example .env
cp .env.local.example .env.local
scripts/dev-up.sh
```

Staging VPS（Docker Compose，CD 默认）：

```bash
cd apps/api
cp .env.example .env
cp .env.staging.example .env.staging
ENV_FILE=.env.staging deploy/remote-deploy.sh
```

Staging VPS（Kubernetes，当前不启用）：

> Staging 现有宿主机为 2C2G，k3s 控制面和 `kubectl` 操作容易造成资源打满。当前 staging 正式保留 Docker Compose；以下 K8s env 文件只作为未来迁移到更高规格机器时的备用模板。

```bash
cd apps/api/deploy/k8s/overlays/staging
cp env-configs.example .env.staging.configs
cp env-secrets.example   .env.staging.secrets
# 编辑 secrets 后：
kubectl apply -k .
```

Production VPS:

```bash
cd apps/api
cp .env.example .env
cp .env.production.example .env.production
deploy/remote-deploy.sh
```

GitHub Environment secrets can be set with `gh secret set --env staging KEY`, for example:

```bash
gh secret set --env staging CD_PUBLIC_API_URL --body https://staging.xingxiaolin.cn
gh secret set --env staging DEPLOY_HOST --body your-staging-vps-host-or-ip
```

发布晋升策略（staging 先、production 后）：[releases/staging-production-promotion.md](../releases/staging-production-promotion.md)。
