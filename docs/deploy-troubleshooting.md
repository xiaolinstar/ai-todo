# 生产部署踩坑复盘（可复用到其它项目）

本文汇总 ai-todo 在 **GitHub Actions CD + 国内 VPS + GHCR** 路径上真实遇到的问题与修复，便于后续项目对照。项目专用配置见 [deploy.md](./deploy.md)、[ci-cd.md](./ci-cd.md)。

---

## 1. 架构前提（先对齐再排障）

```text
GitHub CI：构建镜像 → push GHCR → 发布 deploy-manifest（gitSha + digest）
GitHub CD：SSH 到 VPS → git pull 部署脚本 → pull 或 build → compose up
VPS：.env.production 注入容器；manifest 只决定「这次部署哪一版镜像/commit」
```

| 误区 | 事实 |
|------|------|
| 密钥打进 Docker 镜像 | 应在 `.env.production` + compose `environment`，见 [deploy.md#配置如何进入-api-容器](./deploy.md#配置如何进入-api-容器) |
| CD 改 `.env` 就能改 API 配置 | CD 注入的变量多给**部署脚本**用；API 仍读服务器上的 `.env.production` |
| 仓库 Private 则镜像必 Private | **可分离**：仓库 Private + GHCR 包 Public |

---

## 2. 问题清单

### 2.1 国内 VPS 拉 GHCR 极慢 / CD 超时

| 项 | 说明 |
|----|------|
| **现象** | `docker pull ghcr.io/...` 单层 10+ 分钟；CD 日志 `Run Command Timeout` |
| **原因** | 跨境访问 `ghcr.io` 带宽差、不稳定 |
| **处理** | ① GHCR 包改 **Public**；② `.env` 或 CD 注入 `AI_TODO_PULL_REGISTRY_MIRROR=ghcr.nju.edu.cn`；③ 单次 pull `timeout` + 少次数重试；④ 限时后 **server-build 兜底**；⑤ 不必死等 canonical `ghcr.io`（`AI_TODO_PULL_SKIP_CANONICAL_FALLBACK=true`） |
| **预防** | 默认 `deploy_mode=auto`；SSH `command_timeout` 与 pull 预算匹配（pull 失败要快，build 另算时间） |

参考：[NJU GHCR 镜像](https://doc.nju.edu.cn/books/e1654/page/ghcr)

---

### 2.2 镜像已拉取成功，仍进入 server-build

曾有多条独立原因，需看日志关键词区分。

#### A. Digest 校验过严（RepoDigests 无 ghcr.io 前缀）

| 项 | 说明 |
|----|------|
| **现象** | 日志有 `Downloaded newer image`，随后 `docker pull deploy failed; falling back to server-build` |
| **原因** | 从 NJU 拉取后 `RepoDigests` 只有 `ghcr.nju.edu.cn/...`，脚本用整段 `ghcr.io/...` grep 失败 |
| **处理** | 按 `sha256:<hex>` 匹配任意 RepoDigests；digest-pinned 且 RepoDigests 为空时信任本地镜像 |

#### B. `docker tag` 两个 digest 互指失败（本次主因之一）

| 项 | 说明 |
|----|------|
| **现象** | `Digest: sha256:...` 后紧跟 `refusing to create a tag with a digest reference`，然后 server-build |
| **原因** | `docker tag ghcr.nju.edu.cn/...@sha256:x ghcr.io/...@sha256:x` 被 Docker 拒绝 |
| **处理** | 在 **mirror ref** 上校验 digest；compose 使用 `ghcr.nju.edu.cn/...@sha256:x`（与 manifest 同 digest）；或 `docker tag <image-id> <canonical>` 成功则用 canonical |
| **预防** | 不要假设「拉完后必须 tag 成 ghcr.io 名才能 up」 |

#### C. Compose 启动或 health 失败

| 项 | 说明 |
|----|------|
| **现象** | 镜像 pull 成功，`docker compose up` 后容器 unhealthy、端口占用或 health/db 超时 |
| **处理** | 不再进入 server-build fallback；直接触发应用 rollback |
| **原因** | 镜像已经可用，失败点在运行时环境、配置、端口、volume 或迁移，重新 build 不能解决 |
| **预防** | 先查 compose / 容器日志；涉及 volume 或 schema 时按 `docs/ops-postgresql-data.md` 与 `docs/database-migrations.md` 处理 |

#### D. Pull 超时（非镜像不存在）

| 项 | 说明 |
|----|------|
| **现象** | 层下载未完成即超时 |
| **处理** | 提高单次 timeout 次数有限；或走 server-build / 换国内 registry（如未来 TCR 双推） |

---

### 2.3 健康检查过早导致 CD 失败（易被误认为 pull 问题）

| 项 | 说明 |
|----|------|
| **现象** | pull 与 `compose up` 成功，随即 `JSONDecodeError: Expecting value`（`/v1/health/db` 空响应） |
| **原因** | 容器 `Started` 后 entrypoint 仍在 `wait_for_db` + `alembic upgrade`，API 尚未监听 |
| **处理** | 轮询 `/v1/health` 再 `/v1/health/db`（默认最多 90–120s） |
| **预防** | 不要用单次 `curl` 判定部署成功 |

---

### 2.4 CD SSH 脚本在 zsh 下语法错误

| 项 | 说明 |
|----|------|
| **现象** | `zsh: parse error near ';'` 或 `bash: line N: syntax error near unexpected token ';'`，约 30–50s 失败 |
| **原因** | VPS 默认 shell 为 **zsh**；workflow 内联 `case … esac` 按 zsh 解析失败；heredoc 带 YAML 缩进也会坑 bash |
| **处理** | ① `git pull` 后执行仓库内 **`cd-bootstrap.sh`**（bash）；② 或 `bash <<'EOF'`，且 heredoc 结束标记顶格 |
| **预防** | **不要**在 `appleboy/ssh-action` 的 `script:` 里写复杂 bash |

---

### 2.5 部署记录写入失败（Python 3.10）

| 项 | 说明 |
|----|------|
| **现象** | `ImportError: cannot import name 'UTC' from 'datetime'` |
| **原因** | 部署脚本用 VPS 的 `python3`（3.10）；代码写了 `from datetime import UTC`（3.11+） |
| **处理** | 改用 `from datetime import timezone` + `datetime.now(timezone.utc)` |
| **预防** | 部署脚本与 API 容器 Python 版本分开考虑；脚本保持 3.9+ 兼容 |

---

### 2.6 server-build 时 apt / pip 很慢

| 项 | 说明 |
|----|------|
| **现象** | `apt-get update` 卡住；CD 在 build 阶段再次超时 |
| **原因** | Dockerfile 默认 Debian 官方源；国内构建未传镜像参数 |
| **处理** | `docker-compose.prod.yml` 传 `APT_MIRROR=mirrors.tencent.com`、`PIP_INDEX_URL` 腾讯云；CI 构建可不传（跑在 GitHub） |
| **预防** | 优先修 pull 路径，减少落入 server-build |

---

### 2.7 多次部署后磁盘被旧镜像占满

| 项 | 说明 |
|----|------|
| **现象** | `docker system df` 中 Images 持续增长 |
| **原因** | 每次 pull/build 产生新 digest，未清理 |
| **处理** | `.deploy/image-retention.json` 保留最近 N 个 digest（默认 3）；部署成功后跑 `prune-container-images.sh` |
| **预防** | 不 prune 正在运行的容器镜像；不删 `postgres` 等基础镜像 |

---

## 3. 推荐默认配置（国内 VPS + GHCR）

| 配置项 | 推荐值 |
|--------|--------|
| GHCR 包可见性 | Public（仓库可仍 Private） |
| CD `deploy_mode` | `auto`（pull + server-build 兜底） |
| 镜像站 | CD 注入 `AI_TODO_PULL_REGISTRY_MIRROR=ghcr.nju.edu.cn` |
| Pull | 2 次重试、单次 timeout 约 180s、跳过慢速 canonical 回退 |
| 健康检查等待 | 90–120s |
| 镜像保留 | `AI_TODO_IMAGE_RETENTION=3` |
| server-build | `APT_MIRROR` + `PIP_INDEX_URL` 国内源 |
| SSH 脚本 | 只调 `git pull` + `bash apps/api/deploy/cd-bootstrap.sh` |

---

## 4. 排障速查（看日志关键词）

| 日志片段 | 方向 |
|----------|------|
| `parse error near ';'` | zsh / 内联 bash → 改用 `cd-bootstrap.sh` |
| `refusing to create a tag with a digest reference` | digest tag → 用 mirror ref 做 compose image |
| `Mirror pull failed` 但上面有 `Downloaded newer` | 查 tag / digest 校验，不是网络 |
| `JSONDecodeError` + health/db | 加长健康检查轮询 |
| `ImportError: UTC` | 部署脚本 Python 3.10 兼容 |
| `Run Command Timeout` 在 pull 中 | 镜像站 / 缩短 pull / 或接受 server-build |
| `Run Command Timeout` 在 build 中 | apt/pip 镜像、或增大 timeout / 优化 Dockerfile |

---

## 5. 部署后自检

```bash
# 版本与方式
cat ~/AgentProjects/ai-todo/.deploy/current.json   # deployMode、gitSha、apiDigest

# 服务
curl -sf http://127.0.0.1:8082/v1/health
curl -sf http://127.0.0.1:8082/v1/health/db

# 磁盘
docker images | grep ai-todo-api
docker system df
```

---

## 6. 在新项目中的迁移建议

1. **制品**：继续用 manifest + digest，不要只靠「main 最新」。
2. **CD 脚本放仓库**：SSH 只 `git pull` + 执行 `deploy/*.sh`，避免 workflow 内联 shell。
3. **国内默认**：registry 镜像站 + pull 失败快速 fallback build，两套源（apt/pip）分开配置 CI 与 VPS。
4. **校验镜像**：digest-pinned pull 成功后，不要依赖 `docker tag @sha256 → @sha256`。
5. **部署脚本 Python**：按 VPS 系统 `python3` 最低版本写（通常 3.10），与运行时容器版本解耦。
6. **留存策略**：`.deploy/current.json` + 保留 N 个 digest + 自动 prune。

---

## 相关文档

- [deploy.md](./deploy.md) — 生产部署与配置分层
- [ci-cd.md](./ci-cd.md) — CI/CD 流水线与环境变量表
- [release-runbook.md](./release-runbook.md) — 上线 checklist
