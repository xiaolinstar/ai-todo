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
