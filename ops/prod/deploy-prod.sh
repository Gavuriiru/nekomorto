#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/srv/nekomorto}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL:-https://nekomata.moe}"
EXPECTED_MAINTENANCE="${EXPECTED_MAINTENANCE:-false}"

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

echo "[deploy] Syncing repository..."
git fetch --prune origin
git checkout "${DEPLOY_BRANCH}"
git reset --hard "origin/${DEPLOY_BRANCH}"

echo "[deploy] Ensuring postgres is running..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres

echo "[deploy] Building app image..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build app

echo "[deploy] Applying Prisma migrations..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm app npm run prisma:migrate:deploy

echo "[deploy] Starting app + caddy..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d app caddy

echo "[deploy] Running internal health checks..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm app \
  node scripts/check-health.mjs \
  --base=http://app:8080 \
  --expect-source=db \
  --expect-maintenance="${EXPECTED_MAINTENANCE}"

echo "[deploy] Running external health check..."
curl -fsS "${HEALTHCHECK_BASE_URL}/api/health" >/dev/null

echo "[deploy] Current services:"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo "[deploy] Completed successfully."
