#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.staging}"
SERVICE_NAME="${SERVICE_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_NAME="${APP_DB_NAME:-nekomorto}"
DB_USER="${APP_DB_USER:-nekomorto_app}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

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

mkdir -p "${BACKUP_DIR}"

TMP_FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz.tmp"
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps "${SERVICE_NAME}" >/dev/null

docker compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  exec -T \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  "${SERVICE_NAME}" \
  pg_dump --clean --if-exists --no-owner --no-privileges -U "${DB_USER}" "${DB_NAME}" \
  | gzip -9 > "${TMP_FILE}"

if [[ ! -s "${TMP_FILE}" ]]; then
  echo "Backup output is empty: ${TMP_FILE}" >&2
  rm -f "${TMP_FILE}"
  exit 1
fi

mv "${TMP_FILE}" "${OUT_FILE}"

find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "Backup saved: ${OUT_FILE}"
