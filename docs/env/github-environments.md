# GitHub Actions L2（Variables / Secrets）

对齐 GitHub 官方名称：**Variables**（变量）与 **Secrets**（密钥）。

真值与同步见 [dev-standards env-management](~/AgentProjects/dev-standards/playbook/env-management.md)、[ADR-0012](~/AgentProjects/dev-standards/playbook/adr/0012-config-github-l2-only.md)。

**不在此仓库提交真实值。** L0 模板：

```text
docs/env/github/<environment>/
├── variables.env.example
└── secrets.env.example
```

## 单一真源

| 层                         | 内容                      | 真源                                               |
| -------------------------- | ------------------------- | -------------------------------------------------- |
| **L2 Variables / Secrets** | `DEPLOY_*`、探活 URL、SSH | GitHub Environments ← 本地 IaC 同步                |
| **L3 运行时**              | DB、微信密钥              | **仅 VPS**（`.env.production` / K8s secrets 文件） |

## 命名对照

| GitHub Environment | 含义                       | 应用 `AI_TODO_ENVIRONMENT` |
| ------------------ | -------------------------- | -------------------------- |
| `production-k8s`   | CD 部署面（111 · K8s）     | `production`               |
| `production`       | CD 部署面（124 · Compose） | `production`               |
| `staging`          | CD 部署面                  | `staging`                  |

## 本地 IaC 路径

```text
~/.config/xiaolinstar/ai-todo/github/
├── production/
│   ├── variables.env
│   └── secrets.env
├── staging/
│   ├── variables.env
│   └── secrets.env
└── production-k8s/
    ├── variables.env
    └── secrets.env
```

## 统一键名

三个 GitHub Environment 的 L0 模板**键名完全相同**，仅下列值因部署面不同：

| 键                        | 差异说明                                    |
| ------------------------- | ------------------------------------------- |
| `GITHUB_ENVIRONMENT`      | `staging` / `production` / `production-k8s` |
| `DEPLOY_HOST` 等 SSH 目标 | 各 VPS IP                                   |
| `CD_PUBLIC_API_URL`       | staging 域名 vs 生产域名                    |
| `CD_LOCAL_HEALTH_URL`     | K8s 切流前本机探活（可选；Compose 留空）    |
| `DEPLOY_BACKEND`          | `compose` 或 `k8s`                          |

`K8S_*` 在所有模板中均列出；仅当 `DEPLOY_BACKEND=k8s` 时 CD 读取。这样换部署面时不必改模板结构，只改变量值。

## SSH 认证（Secrets）

默认 **`DEPLOY_PASSWORD`**（SSH 登录密码）。备选 **`DEPLOY_SSH_KEY_FILE`**（本地私钥路径，sync 推送为 `DEPLOY_SSH_KEY`）。二选一必填；CD 同时存在时优先密钥。

模板内按分区标注 `[必填]` / `[可选]` / `[k8s]`，见各 `*.env.example` 文件头注释。

## 工作流

```bash
~/AgentProjects/dev-standards/scripts/sync.sh env init-config
~/AgentProjects/dev-standards/scripts/sync.sh env init-github-env \
  --project ai-todo --environment production-k8s

# 编辑 ~/.config/.../production-k8s/variables.env 与 secrets.env

~/AgentProjects/dev-standards/scripts/sync.sh env sync-github \
  --project ai-todo --environment production-k8s --dry-run
```

## L0 模板索引

| GitHub Environment | Variables                                                            | Secrets                                                          |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `production`       | [variables.env.example](github/production/variables.env.example)     | [secrets.env.example](github/production/secrets.env.example)     |
| `staging`          | [variables.env.example](github/staging/variables.env.example)        | [secrets.env.example](github/staging/secrets.env.example)        |
| `production-k8s`   | [variables.env.example](github/production-k8s/variables.env.example) | [secrets.env.example](github/production-k8s/secrets.env.example) |

## 相关

- [README.md](README.md) — L3 运行时
- [../deploy-kubernetes.md](../deploy-kubernetes.md)
- [../ci-cd.md](../ci-cd.md)
