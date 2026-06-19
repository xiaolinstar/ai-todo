# 数据库迁移与发布策略

ai-todo 的 API 镜像是不可变制品，但 PostgreSQL 数据保存在 Docker volume 中，会随 Alembic migration 持续演进。应用可以按旧镜像回滚，数据库 schema 不会自动回滚，所以迁移必须默认向前兼容。

运维视角的 PostgreSQL volume、备份、恢复与危险命令见 [ops-postgresql-data.md](./ops-postgresql-data.md)。

## 发布原则

使用 expand / deploy / backfill / contract：

1. **Expand**：只新增兼容结构，例如新表、新 nullable 列、新索引、新宽松约束。旧版本 API 继续可运行。
2. **Deploy**：部署新应用代码，让它同时兼容旧字段和新字段，或开始双写。
3. **Backfill**：补历史数据。大数据量补偿不要放在请求路径里。
4. **Contract**：确认没有旧代码依赖后，再删除旧字段、旧表、旧索引或收紧约束。Contract 应独立成后续发布。

## 禁止和高风险操作

不要在同一次应用发布中做这些事：

- 直接 `drop_table` / `drop_column`
- 直接 rename 表或列
- 直接把已有列改成 `nullable=False`
- 直接修改已有列类型
- 直接删除旧约束导致旧版本写入行为变化
- 通过 `op.execute` 执行 `DROP` / `ALTER` / `TRUNCATE`

确实需要做破坏性迁移时，必须拆成独立 contract 发布，并满足：

- 线上已经确认没有旧代码会读写旧结构
- 已有数据已备份或可重建
- 回滚计划写在 PR 描述和 migration 注释中
- migration 文件显式包含 `ai-todo-migration: allow-destructive`

## Alembic Guardrail

CI 会运行：

```bash
cd apps/api
python scripts/check_alembic_migrations.py
```

该脚本以 `20260527_0012` 为历史基线，只检查之后新增的 migration。发现高风险操作会失败，除非 migration 文件带有显式 review 标记：

```python
# ai-todo-migration: allow-destructive
# Reason: contract release after version <sha>; old column has not been read for 2 releases.
```

这个标记不是逃生口，而是“人工确认已读过风险”的审计点。

## 常见改法

### 新增必填字段

不要一步到位：

```python
op.add_column("contacts", sa.Column("source", sa.String(32), nullable=False))
```

推荐：

1. 新增 nullable 列或带 server default 的列。
2. 新代码写入该字段，同时读取时兼容空值。
3. backfill 历史数据。
4. 后续 contract 发布再改 `nullable=False`。

### 重命名字段

不要直接 rename。推荐：

1. 新增新列。
2. 新代码双写旧列和新列，读取优先新列，fallback 旧列。
3. backfill 新列。
4. 观察至少一个发布周期。
5. contract 发布删除旧列。

### 删除字段或表

先停止代码读写，再发布观察，再 contract 删除。删除类 migration 永远不要和业务代码迁移混在同一个发布里。

## 与自动回滚的关系

CD 自动回滚只恢复：

- Git worktree 到上一版 `gitSha`
- API 容器到上一版 image digest

它不会恢复：

- Alembic revision
- PostgreSQL schema
- 已写入或已改写的数据

因此自动回滚能保护应用启动失败、镜像错误、健康检查失败，但不能弥补破坏性数据库迁移。所有数据库迁移都应先假设“应用可能会回滚到上一版”，再设计 schema 兼容性。
