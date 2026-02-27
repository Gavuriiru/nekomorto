#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/srv/nekomorto}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL:-https://nekomata.moe}"
EXPECTED_MAINTENANCE="${EXPECTED_MAINTENANCE:-false}"
APP_IMAGE_REPO="${APP_IMAGE_REPO:-ghcr.io/gavuriiru/nekomorto}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-latest}"
RUN_CATEGORY6_SMOKE="${RUN_CATEGORY6_SMOKE:-true}"

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

compose_cmd() {
  APP_IMAGE_REPO="${APP_IMAGE_REPO}" APP_IMAGE_TAG="${APP_IMAGE_TAG}" \
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

echo "[deploy] Syncing repository..."
git fetch --prune origin
git checkout "${DEPLOY_BRANCH}"
git reset --hard "origin/${DEPLOY_BRANCH}"

echo "[deploy] Using app image: ${APP_IMAGE_REPO}:${APP_IMAGE_TAG}"

echo "[deploy] Ensuring postgres is running..."
compose_cmd up -d postgres

echo "[deploy] Pulling app image..."
compose_cmd pull app

echo "[deploy] Applying Prisma migrations..."
compose_cmd run --rm app npm run prisma:migrate:deploy

echo "[deploy] Checking uploads integrity..."
compose_cmd run --rm app npm run uploads:check-integrity

echo "[deploy] Starting app + caddy..."
compose_cmd up -d app caddy

echo "[deploy] Validating critical PWA artifacts..."
compose_cmd run --rm app sh -lc '
  for file in dist/manifest.webmanifest dist/sw.js; do
    if [ ! -f "$file" ]; then
      echo "Missing critical PWA artifact: $file" >&2
      exit 1
    fi
  done
  echo "PWA artifacts detected: dist/manifest.webmanifest, dist/sw.js"
'

echo "[deploy] Running internal health checks..."
compose_cmd run --rm app \
  node scripts/check-health.mjs \
  --base=http://app:8080 \
  --expect-source=db \
  --expect-maintenance="${EXPECTED_MAINTENANCE}"

if [[ "${RUN_CATEGORY6_SMOKE}" == "true" ]]; then
  echo "[deploy] Running category6 internal smoke checks..."
  compose_cmd run --rm app \
    node scripts/check-category6-smoke.mjs \
    --base=http://app:8080
fi

echo "[deploy] Running external health check..."
curl -fsS "${HEALTHCHECK_BASE_URL}/api/health" >/dev/null

if [[ "${RUN_CATEGORY6_SMOKE}" == "true" ]]; then
  echo "[deploy] Running category6 external smoke checks..."
  compose_cmd run --rm app \
    node scripts/check-category6-smoke.mjs \
    --base="${HEALTHCHECK_BASE_URL}"
fi

echo "[deploy] Current services:"
compose_cmd ps

echo "[deploy] Completed successfully."
