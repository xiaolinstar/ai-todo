#!/usr/bin/env bash
# Invoked by GitHub Actions CD after git pull on the VPS.
# Expects deploy secrets/env from ssh-action (FINGERPRINT, CI_RUN_ID, DEPLOY_MODE_INPUT, …).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "CD action=${AI_TODO_CD_ACTION:-deploy} fingerprint=${FINGERPRINT:-} ci_run=${CI_RUN_ID:-} deploy_mode_input=${DEPLOY_MODE_INPUT:-auto}"

if [[ "${AI_TODO_CD_ACTION:-deploy}" == "rollback" ]]; then
  exec bash "$SCRIPT_DIR/deploy-from-manifest.sh" --rollback-to-previous
fi

export AI_TODO_DEPLOY_MANIFEST="${AI_TODO_DEPLOY_MANIFEST:-/tmp/deploy-manifest.json}"
export AI_TODO_PULL_REGISTRY_MIRROR="${AI_TODO_PULL_REGISTRY_MIRROR:-ghcr.nju.edu.cn}"
export AI_TODO_PULL_RETRIES="${AI_TODO_PULL_RETRIES:-2}"
export AI_TODO_PULL_TIMEOUT_SECONDS="${AI_TODO_PULL_TIMEOUT_SECONDS:-180}"
export AI_TODO_PULL_SKIP_CANONICAL_FALLBACK="${AI_TODO_PULL_SKIP_CANONICAL_FALLBACK:-true}"
export AI_TODO_HEALTH_WAIT_SECONDS="${AI_TODO_HEALTH_WAIT_SECONDS:-90}"

deploy_mode_input="${DEPLOY_MODE_INPUT:-auto}"
case "$deploy_mode_input" in
  server-build)
    export AI_TODO_DEPLOY_MODE=server-build
    export AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD=false
    ;;
  pull)
    export AI_TODO_DEPLOY_MODE=pull
    export AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD=false
    ;;
  *)
    export AI_TODO_DEPLOY_MODE=pull
    export AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD=true
    ;;
esac

exec bash "$SCRIPT_DIR/remote-deploy.sh"
