# PostgreSQL Data Runbook

ai-todo 的 API / worker 是无状态容器；PostgreSQL volume 是有状态生产资产，已经存储用户数据。发布、回滚、清理和迁移时必须把 app 与 database 分开看待。

## Current Assets

| Environment      | Compose project      | PostgreSQL volume                          | Notes                                   |
| ---------------- | -------------------- | ------------------------------------------ | --------------------------------------- |
| `staging`        | `ai-todo-staging`    | `ai-todo-staging_ai_todo_postgres_data`    | 可按需重建；不承诺长期保留数据          |
| `production`     | `ai-todo-production` | `ai-todo-production_ai_todo_postgres_data` | 生产用户数据，最高敏感级别              |
| `production` old | `api`                | `api_ai_todo_postgres_data`                | project rename 前旧卷；稳定观察后再清理 |

生产环境不要执行会删除 volume 的命令，除非已经有备份、恢复验证和明确确认。

## Release Types

| Type                    | Scope                                                   | Process                                       |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------- |
| App-only release        | API / worker image, miniapp config, docs, observability | 正常 GitHub Actions CD                        |
| Expand schema release   | 新表、新 nullable 列、新索引、宽松约束                  | 先备份，再显式执行 migration；旧 app 必须兼容 |
| Backfill release        | 历史数据补齐                                            | 独立脚本，要求可重试、可观测、可中断          |
| Contract schema release | 删除列/表、收紧约束、改类型、rename                     | 独立发布窗口；必须先确认旧 app 不再依赖       |
| Volume operation        | volume rename/migration/password repair/restore         | 手工 runbook，默认需要维护窗口                |

Schema 设计规范见 [database-migrations.md](./database-migrations.md)。

## Forbidden In Production

不要在 production 执行：

```bash
docker compose down -v
docker volume rm ai-todo-production_ai_todo_postgres_data
docker volume prune
```

不要为了修复 `password authentication failed` 反复删 volume。Postgres 官方镜像只在 volume 首次创建时读取 `POSTGRES_PASSWORD`；密码轮换见 [deploy.md](./deploy.md#数据库密码)。

## Preflight For DB Changes

包含 Alembic migration 的发布前确认：

- [ ] migration 是否向前兼容
- [ ] 是否只做 expand；如不是，是否已拆成 backfill / contract
- [ ] 是否需要维护窗口
- [ ] 是否已备份 production
- [ ] 是否知道自动回滚不会回滚 schema / data
- [ ] 是否已在 staging 用同类数据路径验证

CI 会运行 `apps/api/scripts/check_alembic_migrations.py`，但 CI 只能挡住明显高风险操作，不能替代人工评审。

K8s 生产环境中，普通 `CD (K8s)` 不再自动运行 Alembic。数据库迁移应通过 `DB Migration (K8s)` workflow 触发，并填写 `production_backup_confirmed=BACKUP_CONFIRMED`。

## Backup

在 production VPS 上执行：

```bash
cd /home/ubuntu/AgentProjects/ai-todo/apps/api

backup="/tmp/ai-todo-production-$(date +%Y%m%d-%H%M%S).sql"

COMPOSE_ENV_FILES=.env,.env.production \
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$backup"

ls -lh "$backup"
```

备份文件应尽快移到受控位置，不要长期只放在 `/tmp`。

## Restore Into A New Project Volume

适用于 Compose project rename 或灾备演练。示例：从旧 `api` 项目迁到 `ai-todo-production`。

```bash
cd /home/ubuntu/AgentProjects/ai-todo/apps/api

# 1. 从旧项目导出
COMPOSE_ENV_FILES=.env,.env.production \
docker compose -p api -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > /tmp/ai-todo-production-before-compose-rename.sql

# 2. .env.production 设置：
# AI_TODO_COMPOSE_PROJECT_NAME=ai-todo-production

# 3. 停旧项目；不要加 -v
COMPOSE_ENV_FILES=.env,.env.production \
docker compose -p api -f docker-compose.prod.yml --profile notifications down

# 4. 只启动新项目 postgres，创建新 volume
COMPOSE_ENV_FILES=.env,.env.production \
docker compose -f docker-compose.prod.yml up -d postgres

# 5. 恢复到新 volume
COMPOSE_ENV_FILES=.env,.env.production \
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  < /tmp/ai-todo-production-before-compose-rename.sql

# 6. 验证数据可读
COMPOSE_ENV_FILES=.env,.env.production \
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "select version_num from alembic_version;"'
```

应用启动交给 GitHub Actions CD，不在服务器上 build：

```text
workflow: CD
environment: production
deploy_mode: auto
```

## Verification

本机：

```bash
curl -sf http://127.0.0.1:8082/v1/health
curl -sf http://127.0.0.1:8082/v1/health/db
```

公网：

```bash
curl -sf https://xingxiaolin.cn/v1/health
curl -sf https://xingxiaolin.cn/v1/health/db
```

GitHub Actions CD 还会校验 `gitSha`，并在 `CD_SMOKE_PAT` 存在时执行 `/v1/me`、`/v1/today` 认证烟测。

## Rollback Reality

CD 自动回滚只恢复应用：

- Git worktree
- API image digest
- worker image digest

CD 自动回滚不会恢复：

- PostgreSQL volume
- Alembic revision
- 已改写的数据

因此包含 schema/data migration 的发布必须默认“旧 app 可能被重新启动”，并保持向前兼容。
