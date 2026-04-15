#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/srv/nekomorto}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL:-}"
EXPECTED_MAINTENANCE="${EXPECTED_MAINTENANCE:-false}"
APP_IMAGE_REPO="${APP_IMAGE_REPO:-ghcr.io/gavuriiru/nekomorto}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-latest}"
RUN_CATEGORY6_SMOKE="${RUN_CATEGORY6_SMOKE:-true}"
PWA_SMOKE_EXPECT_PROD_HTML="${PWA_SMOKE_EXPECT_PROD_HTML:-true}"
PUBLIC_MEDIA_SMOKE_ENABLED="${PUBLIC_MEDIA_SMOKE_ENABLED:-true}"
SKIP_GIT_SYNC="${SKIP_GIT_SYNC:-false}"

if [[ ! -d "${DEPLOY_PATH}" ]]; then
  echo "Deploy path not found: ${DEPLOY_PATH}" >&2
  exit 1
fi

cd "${DEPLOY_PATH}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${DEPLOY_PATH}/${ENV_FILE}" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing compose file: ${DEPLOY_PATH}/${COMPOSE_FILE}" >&2
  exit 1
fi

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

strip_wrapping_quotes() {
  local value="$1"
  if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

read_env_value() {
  local key="$1"
  local file_path="$2"
  local line
  local value=""

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    line="$(trim "${line}")"
    if [[ -z "${line}" || "${line}" == \#* ]]; then
      continue
    fi
    if [[ "${line}" != "${key}"=* ]]; then
      continue
    fi
    value="${line#*=}"
  done < "${file_path}"

  strip_wrapping_quotes "$(trim "${value}")"
}

normalize_domain_candidate() {
  local value
  value="$(strip_wrapping_quotes "$(trim "$1")")"
  if [[ -z "${value}" ]]; then
    return 0
  fi
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%\?*}"
  value="${value%%#*}"
  value="${value%%:*}"
  value="${value#.}"
  value="${value%.}"
  printf '%s' "${value,,}"
}

origin_host_by_index() {
  local index="$1"
  local raw_origins="$2"
  local -a origins=()
  IFS=',' read -r -a origins <<< "${raw_origins}"
  normalize_domain_candidate "${origins[${index}]:-}"
}

require_non_empty() {
  local name="$1"
  local value="$2"
  local message="$3"
  if [[ -n "${value}" ]]; then
    return 0
  fi
  echo "${name} ${message}" >&2
  exit 1
}

require_file() {
  local path="$1"
  local description="$2"
  if [[ -f "${path}" ]]; then
    return 0
  fi
  echo "Missing ${description}: ${path}" >&2
  exit 1
}

resolve_proxy_overlay_file() {
  local provider="$1"
  local compose_dir
  compose_dir="$(dirname "${COMPOSE_FILE}")"
  if [[ "${compose_dir}" == "." ]]; then
    printf 'docker-compose.prod.%s.yml' "${provider}"
    return 0
  fi
  printf '%s/docker-compose.prod.%s.yml' "${compose_dir}" "${provider}"
}

APP_ORIGIN_ENV="$(read_env_value APP_ORIGIN "${ENV_FILE}")"
PRIMARY_ORIGIN_HOST="$(origin_host_by_index 0 "${APP_ORIGIN_ENV}")"
SECONDARY_ORIGIN_HOST="$(origin_host_by_index 1 "${APP_ORIGIN_ENV}")"

PROXY_PROVIDER_RAW="${PROXY_PROVIDER:-$(read_env_value PROXY_PROVIDER "${ENV_FILE}")}"
PROXY_PROVIDER="$(trim "${PROXY_PROVIDER_RAW,,}")"
if [[ -z "${PROXY_PROVIDER}" ]]; then
  PROXY_PROVIDER="caddy"
fi

APP_DOMAIN_RAW="${APP_DOMAIN:-$(read_env_value APP_DOMAIN "${ENV_FILE}")}"
APP_DOMAIN="$(normalize_domain_candidate "${APP_DOMAIN_RAW}")"
if [[ -z "${APP_DOMAIN}" ]]; then
  if [[ -n "${PRIMARY_ORIGIN_HOST}" && "${PRIMARY_ORIGIN_HOST}" == www.* && -n "${SECONDARY_ORIGIN_HOST}" ]]; then
    APP_DOMAIN="${SECONDARY_ORIGIN_HOST}"
  elif [[ -n "${PRIMARY_ORIGIN_HOST}" ]]; then
    APP_DOMAIN="${PRIMARY_ORIGIN_HOST}"
  else
    APP_DOMAIN="$(normalize_domain_candidate "${HEALTHCHECK_BASE_URL}")"
  fi
fi

APP_WWW_DOMAIN_RAW="${APP_WWW_DOMAIN:-$(read_env_value APP_WWW_DOMAIN "${ENV_FILE}")}"
APP_WWW_DOMAIN="$(normalize_domain_candidate "${APP_WWW_DOMAIN_RAW}")"
if [[ -z "${APP_WWW_DOMAIN}" && "${APP_DOMAIN}" == www.* ]]; then
  APP_WWW_DOMAIN="${APP_DOMAIN}"
  APP_DOMAIN="${APP_DOMAIN#www.}"
fi
if [[ -z "${APP_WWW_DOMAIN}" ]]; then
  if [[ -n "${SECONDARY_ORIGIN_HOST}" && "${SECONDARY_ORIGIN_HOST}" != "${APP_DOMAIN}" ]]; then
    APP_WWW_DOMAIN="${SECONDARY_ORIGIN_HOST}"
  elif [[ -n "${PRIMARY_ORIGIN_HOST}" && "${PRIMARY_ORIGIN_HOST}" == www.* && "${PRIMARY_ORIGIN_HOST#www.}" == "${APP_DOMAIN}" ]]; then
    APP_WWW_DOMAIN="${PRIMARY_ORIGIN_HOST}"
  elif [[ -n "${APP_DOMAIN}" && "${APP_DOMAIN}" != www.* ]]; then
    APP_WWW_DOMAIN="www.${APP_DOMAIN}"
  fi
fi

TRAEFIK_ACME_EMAIL="${TRAEFIK_ACME_EMAIL:-$(read_env_value TRAEFIK_ACME_EMAIL "${ENV_FILE}")}"
TRAEFIK_ACME_EMAIL="$(trim "${TRAEFIK_ACME_EMAIL}")"
NGINX_TLS_CERT_PATH="${NGINX_TLS_CERT_PATH:-$(read_env_value NGINX_TLS_CERT_PATH "${ENV_FILE}")}"
NGINX_TLS_CERT_PATH="$(trim "${NGINX_TLS_CERT_PATH}")"
NGINX_TLS_KEY_PATH="${NGINX_TLS_KEY_PATH:-$(read_env_value NGINX_TLS_KEY_PATH "${ENV_FILE}")}"
NGINX_TLS_KEY_PATH="$(trim "${NGINX_TLS_KEY_PATH}")"
HEALTHCHECK_BASE_URL="$(strip_wrapping_quotes "$(trim "${HEALTHCHECK_BASE_URL}")")"

if [[ -z "${HEALTHCHECK_BASE_URL}" && -n "${APP_DOMAIN}" ]]; then
  HEALTHCHECK_BASE_URL="https://${APP_DOMAIN}"
fi
HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL%/}"

case "${PROXY_PROVIDER}" in
  caddy)
    require_non_empty "APP_DOMAIN" "${APP_DOMAIN}" "is required for PROXY_PROVIDER=caddy."
    require_non_empty "APP_WWW_DOMAIN" "${APP_WWW_DOMAIN}" "is required for PROXY_PROVIDER=caddy."
    ;;
  nginx)
    require_non_empty "APP_DOMAIN" "${APP_DOMAIN}" "is required for PROXY_PROVIDER=nginx."
    require_non_empty "APP_WWW_DOMAIN" "${APP_WWW_DOMAIN}" "is required for PROXY_PROVIDER=nginx."
    require_non_empty "NGINX_TLS_CERT_PATH" "${NGINX_TLS_CERT_PATH}" "is required for PROXY_PROVIDER=nginx."
    require_non_empty "NGINX_TLS_KEY_PATH" "${NGINX_TLS_KEY_PATH}" "is required for PROXY_PROVIDER=nginx."
    require_file "${NGINX_TLS_CERT_PATH}" "nginx certificate"
    require_file "${NGINX_TLS_KEY_PATH}" "nginx private key"
    ;;
  traefik)
    require_non_empty "APP_DOMAIN" "${APP_DOMAIN}" "is required for PROXY_PROVIDER=traefik."
    require_non_empty "APP_WWW_DOMAIN" "${APP_WWW_DOMAIN}" "is required for PROXY_PROVIDER=traefik."
    require_non_empty "TRAEFIK_ACME_EMAIL" "${TRAEFIK_ACME_EMAIL}" "is required for PROXY_PROVIDER=traefik."
    ;;
  standalone)
    echo "[deploy] Standalone mode: no reverse proxy. TLS must be handled externally."
    ;;
  *)
    echo "Invalid PROXY_PROVIDER: ${PROXY_PROVIDER}. Allowed values: caddy, nginx, traefik, standalone." >&2
    exit 1
    ;;
esac

if [[ "${PROXY_PROVIDER}" != "standalone" && "${APP_DOMAIN}" == "${APP_WWW_DOMAIN}" ]]; then
  echo "APP_DOMAIN and APP_WWW_DOMAIN must be different values." >&2
  exit 1
fi

require_non_empty "HEALTHCHECK_BASE_URL" "${HEALTHCHECK_BASE_URL}" "could not be derived. Set it explicitly or configure APP_DOMAIN/APP_ORIGIN."

COMPOSE_OVERLAY_FILE="${COMPOSE_OVERLAY_FILE:-$(resolve_proxy_overlay_file "${PROXY_PROVIDER}")}"

compose_cmd() {
  ENV_FILE="${ENV_FILE}" \
  APP_IMAGE_REPO="${APP_IMAGE_REPO}" \
    APP_IMAGE_TAG="${APP_IMAGE_TAG}" \
    APP_DOMAIN="${APP_DOMAIN}" \
    APP_WWW_DOMAIN="${APP_WWW_DOMAIN}" \
    TRAEFIK_ACME_EMAIL="${TRAEFIK_ACME_EMAIL}" \
    NGINX_TLS_CERT_PATH="${NGINX_TLS_CERT_PATH}" \
    NGINX_TLS_KEY_PATH="${NGINX_TLS_KEY_PATH}" \
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${COMPOSE_OVERLAY_FILE}" "$@"
}

if [[ "${SKIP_GIT_SYNC}" == "true" ]]; then
  echo "[deploy] Repository sync skipped (SKIP_GIT_SYNC=true)."
else
  echo "[deploy] Syncing repository..."
  git fetch --prune origin
  git checkout "${DEPLOY_BRANCH}"
  git reset --hard "origin/${DEPLOY_BRANCH}"
fi

echo "[deploy] Using app image: ${APP_IMAGE_REPO}:${APP_IMAGE_TAG}"
echo "[deploy] Using proxy provider: ${PROXY_PROVIDER}"
echo "[deploy] Domains: ${APP_DOMAIN} -> ${APP_WWW_DOMAIN}"
echo "[deploy] Validating compose configuration..."
require_file "${COMPOSE_OVERLAY_FILE}" "proxy overlay compose file"
compose_cmd config >/dev/null

echo "[deploy] Ensuring postgres is running..."
compose_cmd up -d postgres

echo "[deploy] Pulling app image..."
compose_cmd pull app

echo "[deploy] Applying Prisma migrations..."
compose_cmd run --rm app npm run prisma:migrate:deploy

echo "[deploy] Checking uploads integrity..."
compose_cmd run --rm app npm run uploads:check-integrity -- --mode=fast

if [[ "${PROXY_PROVIDER}" == "standalone" ]]; then
  echo "[deploy] Starting app (standalone, no edge)..."
  compose_cmd up -d app
else
  echo "[deploy] Starting app + edge..."
  compose_cmd up -d app edge
fi

echo "[deploy] Running internal health checks..."
compose_cmd run --rm app \
  node scripts/check-health.mjs \
  --base=http://app:8080 \
  --expect-source=db \
  --expect-maintenance="${EXPECTED_MAINTENANCE}"

echo "[deploy] Running internal PWA/public smoke checks..."
compose_cmd run --rm app \
  node scripts/smoke-api.mjs \
  --base=http://app:8080 \
  --expect-prod-html="${PWA_SMOKE_EXPECT_PROD_HTML}" \
  --check-public-media="${PUBLIC_MEDIA_SMOKE_ENABLED}"

if [[ "${RUN_CATEGORY6_SMOKE}" == "true" ]]; then
  echo "[deploy] Running category6 internal smoke checks..."
  compose_cmd run --rm app \
    node scripts/check-category6-smoke.mjs \
    --base=http://app:8080
fi

echo "[deploy] Running external health check..."
curl -fsS "${HEALTHCHECK_BASE_URL}/api/health" >/dev/null

echo "[deploy] Running external PWA/public smoke checks..."
compose_cmd run --rm app \
  node scripts/smoke-api.mjs \
  --base="${HEALTHCHECK_BASE_URL}" \
  --expect-prod-html="${PWA_SMOKE_EXPECT_PROD_HTML}" \
  --check-public-media="${PUBLIC_MEDIA_SMOKE_ENABLED}"

if [[ "${RUN_CATEGORY6_SMOKE}" == "true" ]]; then
  echo "[deploy] Running category6 external smoke checks..."
  compose_cmd run --rm app \
    node scripts/check-category6-smoke.mjs \
    --base="${HEALTHCHECK_BASE_URL}"
fi

echo "[deploy] Current services:"
compose_cmd ps

echo "[deploy] Completed successfully."
