# 运维可观测性

本文记录 ai-todo 当前的 staging、metrics、结构化日志与外部探活分工。

环境变量模板与覆盖加载规则见 [env/README.md](./env/README.md)。

## Staging

CD workflow 已支持 `environment=production|staging`。启用 staging 前必须在 GitHub Settings → Environments 创建 `staging`，并配置独立的：

| Secret                                                                | 说明                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` 或 `DEPLOY_PASSWORD` | staging 服务器 SSH                                   |
| `DEPLOY_PATH`                                                         | staging 仓库路径                                     |
| `CD_PUBLIC_API_URL`                                                   | staging 公网 API，例如 `https://staging.example.com` |
| `CD_SMOKE_PAT`                                                        | 可选，staging 黑盒认证拨测                           |

staging VPS 建议使用 `apps/api/.env` + `apps/api/.env.staging`：

```env
AI_TODO_ENVIRONMENT=staging
AI_TODO_ALLOW_DEV_AUTH=false
AI_TODO_STRUCTURED_LOGS_ENABLED=true
AI_TODO_METRICS_ENABLED=true
```

## Metrics

API 默认暴露 Prometheus 文本格式指标：

```bash
curl https://xingxiaolin.cn/metrics
```

当前指标：

| 指标                                    | 类型      | 说明                                               |
| --------------------------------------- | --------- | -------------------------------------------------- |
| `ai_todo_build_info`                    | gauge     | environment / release tag / git sha                |
| `ai_todo_process_start_time_seconds`    | gauge     | API 进程启动时间                                   |
| `ai_todo_http_requests_total`           | counter   | 按 method / route path / status class 聚合的请求数 |
| `ai_todo_http_request_duration_seconds` | histogram | 按 method / route path / status class 聚合的延迟   |

如需关闭：

```env
AI_TODO_METRICS_ENABLED=false
```

## 结构化日志

API 默认输出 JSON access log。每个请求包含：

- `requestId`
- `method`
- `path`
- `status`
- `durationMs`
- `environment`
- `releaseTag`
- `gitSha`

请求响应会带上 `X-Request-ID`，便于从客户端反馈追到服务器日志。

如需关闭 JSON 日志：

```env
AI_TODO_STRUCTURED_LOGS_ENABLED=false
```

JSON API 响应体（`/v1/*`）同样携带 `requestId` 与 `traceId`（与 `X-Request-ID` 同值），便于客户端报错时直接提供排障 ID。

## 外部存活探活

定期公网存活检查由 [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 的 `uptime.yml` 负责：每 15 分钟请求 `GET /healthz`（完整链路 DNS → TLS → Nginx → API），并检查 TLS 证书是否在 14 天内过期。规范见 gateway [healthz-probe-standard.md](https://github.com/xiaolinstar/xiaolin-gateway/blob/main/docs/healthz-probe-standard.md)。

本仓库不再维护独立的 Monitor workflow；`/v1/health*` 仍供 CD 部署验收与运维手动深度检查。后续 DB 深度探活计划在 gateway 侧补充。
