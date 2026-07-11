#!/usr/bin/env bash
# Run Alembic migrations as an explicit K8s operations action.
# Expects: AI_TODO_DEPLOY_MANIFEST, K8S_MIGRATION_OVERLAY, K8S_NAMESPACE, K8S_REGISTRY_MIRROR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST="${AI_TODO_DEPLOY_MANIFEST:-/tmp/deploy-manifest.json}"

K8S_MIGRATION_OVERLAY="${K8S_MIGRATION_OVERLAY:-apps/api/deploy/k8s/overlays/production-migration}"
K8S_NAMESPACE="${K8S_NAMESPACE:-ai-todo}"
K8S_REGISTRY_MIRROR="${K8S_REGISTRY_MIRROR:-ghcr.nju.edu.cn}"
MIGRATION_WAIT_SECONDS="${AI_TODO_MIGRATION_WAIT_SECONDS:-300}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing deploy manifest: $MANIFEST" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required on the K8s host" >&2
  exit 1
fi

if ! command -v kustomize >/dev/null 2>&1; then
  KUSTOMIZE_BIN="${HOME}/.local/bin/kustomize"
  if [[ ! -x "$KUSTOMIZE_BIN" ]]; then
    echo "Installing kustomize to $KUSTOMIZE_BIN"
    mkdir -p "$(dirname "$KUSTOMIZE_BIN")"
    tmpdir="$(mktemp -d)"
    curl -fsSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v5.6.0/kustomize_v5.6.0_linux_amd64.tar.gz" \
      | tar -xzf - -C "$tmpdir"
    install -m 0755 "$tmpdir/kustomize" "$KUSTOMIZE_BIN"
    rm -rf "$tmpdir"
  fi
  export PATH="$(dirname "$KUSTOMIZE_BIN"):$PATH"
fi

python3 "$REPO_ROOT/scripts/ci/verify_deploy_manifest.py" "$MANIFEST"

eval "$(python3 - <<'PY' "$MANIFEST"
import json, shlex, sys
m = json.load(open(sys.argv[1]))
api = m["artifacts"]["api"]
fields = {
    "GIT_SHA": m["gitSha"],
    "API_DIGEST": api["digest"],
}
for key, val in fields.items():
    print(f"{key}={shlex.quote(str(val))}")
PY
)"

if [[ -z "$GIT_SHA" || -z "$API_DIGEST" ]]; then
  echo "Failed to parse manifest (git_sha/digest empty)" >&2
  exit 1
fi

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
if [[ ! -f "$KUBECONFIG" && -f /etc/rancher/k3s/k3s.yaml ]]; then
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
fi
if [[ ! -f "$KUBECONFIG" ]]; then
  echo "Missing kubeconfig (expected ~/.kube/config or /etc/rancher/k3s/k3s.yaml)" >&2
  exit 1
fi

cd "$REPO_ROOT"
git fetch origin
git reset --hard "$GIT_SHA"
git clean -fd -- "$K8S_MIGRATION_OVERLAY" 2>/dev/null || true

OVERLAY_DIR="$REPO_ROOT/$K8S_MIGRATION_OVERLAY"
if [[ ! -d "$OVERLAY_DIR" ]]; then
  echo "Missing K8s migration overlay directory: $OVERLAY_DIR" >&2
  exit 1
fi

DIGEST="$API_DIGEST"
if [[ "$DIGEST" != sha256:* ]]; then
  DIGEST="sha256:${DIGEST#sha256:}"
fi
MIRROR_REF="${K8S_REGISTRY_MIRROR}/xiaolinstar/ai-todo-api@${DIGEST}"

cd "$OVERLAY_DIR"
kustomize edit set image "ghcr.io/xiaolinstar/ai-todo-api=${MIRROR_REF}"

echo "Running DB migration job"
echo "  git_sha=${GIT_SHA}"
echo "  image=${MIRROR_REF}"
echo "  overlay=${K8S_MIGRATION_OVERLAY}"
echo "  namespace=${K8S_NAMESPACE}"

kubectl get configmap/ai-todo-config -n "$K8S_NAMESPACE" >/dev/null
kubectl get secret/ai-todo-secrets -n "$K8S_NAMESPACE" >/dev/null
kubectl delete job/db-migration -n "$K8S_NAMESPACE" --ignore-not-found=true
kubectl apply -k .

if ! kubectl wait --for=condition=complete job/db-migration -n "$K8S_NAMESPACE" --timeout="${MIGRATION_WAIT_SECONDS}s"; then
  echo "Migration job failed or timed out; recent logs:" >&2
  kubectl logs job/db-migration -n "$K8S_NAMESPACE" --tail=200 >&2 || true
  exit 1
fi

kubectl logs job/db-migration -n "$K8S_NAMESPACE" --tail=200
echo "DB migration complete"
