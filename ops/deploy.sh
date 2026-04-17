#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bash ops/deploy.sh <prod|dev> <setup|deploy|status|logs|rollback> [flags]

Examples:
  bash ops/deploy.sh prod setup
  bash ops/deploy.sh prod deploy
  bash ops/deploy.sh prod status
  bash ops/deploy.sh prod logs
  bash ops/deploy.sh prod rollback --tag sha-0000000000000000000000000000000000000000
  bash ops/deploy.sh dev deploy

Most flags are passed through to ops/prod/deploy-prod.sh:
  --deploy-path, --env-file, --compose-file, --branch, --image-repo,
  --image-tag, --tag, --checks, --skip-git-sync, --yes.
EOF
}

fail() {
  echo "[deploy] Problema: $1" >&2
  if [[ -n "${2:-}" ]]; then
    echo "[deploy] Como corrigir: $2" >&2
  fi
  exit 1
}

if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

TARGET="$1"
shift

COMMAND="${1:-deploy}"
if [[ $# -gt 0 ]]; then
  shift
fi

case "${TARGET}" in
  prod)
    exec bash "${ROOT_DIR}/ops/prod/deploy-prod.sh" "${COMMAND}" "$@"
    ;;
  dev)
    case "${COMMAND}" in
      deploy)
        exec bash "${ROOT_DIR}/ops/dev/deploy-dev.sh" "$@"
        ;;
      setup|status|logs|rollback)
        exec bash "${ROOT_DIR}/ops/prod/deploy-prod.sh" "${COMMAND}" \
          --deploy-path "${DEPLOY_PATH:-/srv/nekomorto-dev}" \
          --env-file "${ENV_FILE:-.env.dev}" \
          --compose-file "${COMPOSE_FILE:-docker-compose.prod.yml}" \
          "$@"
        ;;
      *)
        fail "Comando dev desconhecido: ${COMMAND}" "Use deploy, setup, status, logs ou rollback."
        ;;
    esac
    ;;
  *)
    fail "Ambiente desconhecido: ${TARGET}" "Use prod ou dev."
    ;;
esac
