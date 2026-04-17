#!/usr/bin/env bash
set -euo pipefail

COMMAND="deploy"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.quickstart.yml}"
APP_IMAGE_REPO="${APP_IMAGE_REPO:-}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-80}"

usage() {
  cat <<'EOF'
Usage:
  bash quickstart-deploy.sh <deploy|status|logs|rollback> [flags]

Flags:
  --env-file <file>       Default: .env.prod
  --compose-file <file>   Default: docker-compose.quickstart.yml
  --image-repo <repo>     Default: ghcr.io/nekomatasub/nekomorto
  --image-tag <tag>       Image tag to deploy
  --tag <tag>             Alias for --image-tag
  -h, --help              Show this help

Examples:
  bash quickstart-deploy.sh deploy
  bash quickstart-deploy.sh status
  bash quickstart-deploy.sh logs
  bash quickstart-deploy.sh rollback --tag sha-0000000000000000000000000000000000000000
EOF
}

fail() {
  echo "[quickstart] Problema: $1" >&2
  if [[ -n "${2:-}" ]]; then
    echo "[quickstart] Como corrigir: $2" >&2
  fi
  exit 1
}

log() {
  echo "[quickstart] $*"
}

parse_args() {
  if [[ $# -gt 0 ]]; then
    case "$1" in
      deploy|status|logs|rollback)
        COMMAND="$1"
        shift
        ;;
    esac
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        ENV_FILE="${2:-}"
        shift 2
        ;;
      --env-file=*)
        ENV_FILE="${1#*=}"
        shift
        ;;
      --compose-file)
        COMPOSE_FILE="${2:-}"
        shift 2
        ;;
      --compose-file=*)
        COMPOSE_FILE="${1#*=}"
        shift
        ;;
      --image-repo)
        APP_IMAGE_REPO="${2:-}"
        shift 2
        ;;
      --image-repo=*)
        APP_IMAGE_REPO="${1#*=}"
        shift
        ;;
      --image-tag|--tag)
        APP_IMAGE_TAG="${2:-}"
        shift 2
        ;;
      --image-tag=*|--tag=*)
        APP_IMAGE_TAG="${1#*=}"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Argumento desconhecido: $1" "Use --help para ver as opcoes."
        ;;
    esac
  done
}

read_env_value() {
  local key="$1"
  local file_path="$2"
  local line
  local value=""

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    if [[ -z "${line}" || "${line}" == \#* || "${line}" != "${key}"=* ]]; then
      continue
    fi
    value="${line#*=}"
  done < "${file_path}"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

compose_cmd() {
  ENV_FILE="${ENV_FILE}" \
    APP_IMAGE_REPO="${APP_IMAGE_REPO}" \
    APP_IMAGE_TAG="${APP_IMAGE_TAG}" \
    APP_LISTEN_PORT="${APP_LISTEN_PORT}" \
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

validate_context() {
  command -v docker >/dev/null 2>&1 || fail "Docker nao esta instalado." "Instale Docker Engine e Docker Compose plugin."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin nao respondeu." "Instale/ative o Compose v2."
  [[ -f "${ENV_FILE}" ]] || fail "Env file ausente: ${ENV_FILE}" "Baixe o exemplo e preencha valores reais."
  [[ -f "${COMPOSE_FILE}" ]] || fail "Compose file ausente: ${COMPOSE_FILE}" "Baixe docker-compose.quickstart.yml no mesmo diretorio."

  local env_port
  env_port="$(read_env_value APP_LISTEN_PORT "${ENV_FILE}")"
  if [[ -n "${env_port}" ]]; then
    APP_LISTEN_PORT="${env_port}"
  fi
  APP_IMAGE_REPO="${APP_IMAGE_REPO:-$(read_env_value APP_IMAGE_REPO "${ENV_FILE}")}"
  APP_IMAGE_TAG="${APP_IMAGE_TAG:-$(read_env_value APP_IMAGE_TAG "${ENV_FILE}")}"
  APP_IMAGE_REPO="${APP_IMAGE_REPO:-ghcr.io/nekomatasub/nekomorto}"
  APP_IMAGE_TAG="${APP_IMAGE_TAG:-latest}"
}

validate_rollback_tag() {
  if [[ "${APP_IMAGE_TAG}" =~ ^sha-[0-9a-f]{40}$ ]]; then
    return 0
  fi
  fail "Rollback exige tag sha-<40hex>; recebido: ${APP_IMAGE_TAG}" "Informe uma tag imutavel ja publicada."
}

run_deploy() {
  log "Using app image: ${APP_IMAGE_REPO}:${APP_IMAGE_TAG}"
  log "Validating compose configuration..."
  compose_cmd config >/dev/null
  log "Ensuring postgres is running..."
  compose_cmd up -d postgres
  log "Pulling app image..."
  compose_cmd pull app
  log "Applying Prisma migrations..."
  compose_cmd run --rm app npm run prisma:migrate:deploy
  log "Checking uploads integrity..."
  compose_cmd run --rm app npm run uploads:check-integrity -- --mode=fast
  log "Starting app on host port ${APP_LISTEN_PORT}..."
  compose_cmd up -d app
  log "Running health check..."
  curl -fsS "http://localhost:${APP_LISTEN_PORT}/api/health" >/dev/null
  compose_cmd ps
  log "Completed successfully."
}

run_status() {
  log "Configured app image: ${APP_IMAGE_REPO}:${APP_IMAGE_TAG}"
  compose_cmd ps
  log "Local health:"
  curl -fsS "http://localhost:${APP_LISTEN_PORT}/api/health" || true
  echo
}

main() {
  parse_args "$@"
  validate_context

  case "${COMMAND}" in
    deploy)
      run_deploy
      ;;
    status)
      run_status
      ;;
    logs)
      compose_cmd logs -f app
      ;;
    rollback)
      validate_rollback_tag
      run_deploy
      ;;
    *)
      fail "Comando desconhecido: ${COMMAND}" "Use deploy, status, logs ou rollback."
      ;;
  esac
}

main "$@"
