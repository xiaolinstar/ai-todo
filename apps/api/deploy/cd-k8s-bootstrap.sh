#!/usr/bin/env bash
# Invoked by GitHub Actions CD (K8s) after git pull on the VPS.
# This app release path intentionally manages only API/worker resources.
# PostgreSQL and Alembic migrations are handled by dedicated DB runbooks/workflows.
# Expects: AI_TODO_DEPLOY_MANIFEST, K8S_* vars, CD_LOCAL_HEALTH_URL (from GitHub Environment).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/.deploy"
CURRENT_DEPLOY_FILE="$DEPLOY_DIR/current.json"
MANIFEST="${AI_TODO_DEPLOY_MANIFEST:-/tmp/deploy-manifest.json}"

K8S_OVERLAY="${K8S_OVERLAY:-apps/api/deploy/k8s/overlays/production}"
K8S_NAMESPACE="${K8S_NAMESPACE:-ai-todo}"
K8S_REGISTRY_MIRROR="${K8S_REGISTRY_MIRROR:-ghcr.nju.edu.cn}"
CD_LOCAL_HEALTH_URL="${CD_LOCAL_HEALTH_URL:-http://127.0.0.1:30082}"
HEALTH_WAIT_SECONDS="${AI_TODO_HEALTH_WAIT_SECONDS:-180}"

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
    "API_IMAGE": api["image"],
    "API_DIGEST": api["digest"],
    "FINGERPRINT": m["fingerprint"],
    "RUN_ID": m.get("runId") or "",
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

echo "K8s deploy manifest OK"
echo "  git_sha=${GIT_SHA}"
echo "  image=${API_IMAGE}"
echo "  digest=${API_DIGEST}"
echo "  overlay=${K8S_OVERLAY}"
echo "  namespace=${K8S_NAMESPACE}"

cd "$REPO_ROOT"
git fetch origin
git reset --hard "$GIT_SHA"
git clean -fd -- "$K8S_OVERLAY" 2>/dev/null || true

OVERLAY_DIR="$REPO_ROOT/$K8S_OVERLAY"
if [[ ! -d "$OVERLAY_DIR" ]]; then
  echo "Missing K8s overlay directory: $OVERLAY_DIR" >&2
  exit 1
fi

SECRETS_FILE="$OVERLAY_DIR/.env.production.secrets"
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing L3 secrets file: $SECRETS_FILE (copy from env-secrets.example)" >&2
  exit 1
fi

CONFIG_FILE="$OVERLAY_DIR/.env.production.config"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing L3 config file: $CONFIG_FILE (copy from env-config.example)" >&2
  exit 1
fi

DIGEST="$API_DIGEST"
if [[ "$DIGEST" != sha256:* ]]; then
  DIGEST="sha256:${DIGEST#sha256:}"
fi

MIRROR_REF="${K8S_REGISTRY_MIRROR}/xiaolinstar/ai-todo-api@${DIGEST}"

cd "$OVERLAY_DIR"

# Write release metadata to a separate file (generated on each deploy, gitignored)
cat > .env.production.release <<EOF
AI_TODO_GIT_SHA=${GIT_SHA}
AI_TODO_RELEASE_TAG=${AI_TODO_RELEASE_TAG:-}
EOF

kustomize edit set image "ghcr.io/xiaolinstar/ai-todo-api=${MIRROR_REF}"

echo "Applying overlay (image=${MIRROR_REF})"
kubectl diff -k . || true
kubectl apply -k .

kubectl rollout status deployment/api -n "$K8S_NAMESPACE" --timeout="${HEALTH_WAIT_SECONDS}s"

if kubectl get deployment/worker -n "$K8S_NAMESPACE" >/dev/null 2>&1; then
  replicas="$(kubectl get deployment/worker -n "$K8S_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
  if [[ "${replicas:-0}" != "0" ]]; then
    kubectl rollout status deployment/worker -n "$K8S_NAMESPACE" --timeout=180s
  else
    echo "worker replicas=0; skipping rollout wait"
  fi
fi

health_base="${CD_LOCAL_HEALTH_URL%/}"
deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
while (( SECONDS < deadline )); do
  if curl -fsS "${health_base}/v1/health" >/tmp/k8s-health.json 2>/dev/null; then
    break
  fi
  sleep 3
done

if [[ ! -f /tmp/k8s-health.json ]]; then
  echo "Local health check failed: ${health_base}/v1/health" >&2
  exit 1
fi

python3 - <<'PY' /tmp/k8s-health.json "$GIT_SHA"
import json, sys
payload = json.load(open(sys.argv[1]))
data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
expected = sys.argv[2].strip().lower()
actual = (data.get("gitSha") or data.get("git_sha") or "").strip().lower()
if not actual:
    raise SystemExit("health response missing gitSha (check AI_TODO_GIT_SHA in configmap)")
if actual != expected and not actual.startswith(expected[:7]):
    raise SystemExit(f"gitSha mismatch: expected {expected}, got {actual}")
print(f"health ok gitSha={actual}")
PY

db_deadline=$((SECONDS + 60))
db_ok=false
while (( SECONDS < db_deadline )); do
  if curl -fsS "${health_base}/v1/health/db" >/dev/null 2>&1; then
    db_ok=true
    break
  fi
  sleep 2
done

if [ "$db_ok" = false ]; then
  echo "DB health check failed after timeout: ${health_base}/v1/health/db" >&2
  # Try one last time without silencing stderr to print the error reason
  curl -fsS "${health_base}/v1/health/db" >/dev/null || true
  exit 1
fi
echo "DB health OK"

mkdir -p "$DEPLOY_DIR"
python3 - <<'PY' "$CURRENT_DEPLOY_FILE" "$GIT_SHA" "$API_IMAGE" "$API_DIGEST" "$FINGERPRINT" "$RUN_ID"
import json, sys
from datetime import datetime, timezone
from pathlib import Path

output, git_sha, api_image, api_digest, fingerprint, ci_run_id = sys.argv[1:7]
payload = {
    "gitSha": git_sha,
    "apiImage": api_image,
    "apiDigest": api_digest,
    "fingerprint": fingerprint,
    "ciRunId": ci_run_id or None,
    "deployMode": "k8s",
    "deployBackend": "k8s",
    "status": "deployed",
    "deployedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
}
Path(output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {output}")
PY

echo "K8s CD complete"
