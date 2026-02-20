#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.staging}"
SERVICE_NAME="${SERVICE_NAME:-postgres}"
DB_NAME="${APP_DB_NAME:-nekomorto}"
DB_USER="${APP_DB_USER:-nekomorto_app}"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup.sql.gz|backup.sql>" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_PASSWORD is required in ${ENV_FILE}" >&2
  exit 1
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps "${SERVICE_NAME}" >/dev/null

if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | docker compose \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    exec -T \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${SERVICE_NAME}" \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
else
  cat "${BACKUP_FILE}" | docker compose \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    exec -T \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${SERVICE_NAME}" \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
fi

echo "Restore finished from: ${BACKUP_FILE}"
