# GitHub Environments

This document records the intended GitHub Actions configuration. Store real secret values only in GitHub, not in this repository.

## Variables

| Name | production | staging | Notes |
|------|------------|---------|-------|
| `DEPLOY_HOST` | required | required | VPS host or IP |
| `DEPLOY_USER` | required | required | SSH user |
| `DEPLOY_PORT` | `22` | `22` | SSH port |
| `DEPLOY_PATH` | required | required | Repo path on VPS |
| `CD_PUBLIC_API_URL` | `https://xingxiaolin.cn` | `https://staging.xingxiaolin.cn` | Public API base URL |
| `ALERT_MAX_LATENCY_MS` | `2000` | `5000` | Monitor health latency threshold |
| `ALERT_TIMEOUT` | optional | optional | Defaults to `10` seconds |
| `ALERT_LATENCY_SAMPLES` | optional | optional | Defaults to `3` samples |
| `GHCR_DEPLOY_USER` | optional | optional | Defaults to GitHub actor |

## Secrets

| Name | production | staging | Notes |
|------|------------|---------|-------|
| `DEPLOY_SSH_KEY` or `DEPLOY_PASSWORD` | required | required | Prefer SSH key |
| `CD_SMOKE_PAT` | optional | optional | Authenticated smoke checks |
| `GHCR_DEPLOY_TOKEN` | optional | optional | Required for private GHCR packages |
| `ALERT_WEBHOOK_URL` | optional | optional | Failure webhook |

## gh Examples

```bash
gh variable set ALERT_MAX_LATENCY_MS --env production --body 2000
gh variable set ALERT_MAX_LATENCY_MS --env staging --body 5000
```
