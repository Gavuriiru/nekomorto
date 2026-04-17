#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DEPLOY_PATH="${DEPLOY_PATH:-/srv/nekomorto-dev}"
export DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
export ENV_FILE="${ENV_FILE:-.env.dev}"
export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
export HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL:-https://dev.nekomata.moe}"
export EXPECTED_MAINTENANCE="${EXPECTED_MAINTENANCE:-false}"
export PWA_SMOKE_EXPECT_PROD_HTML="${PWA_SMOKE_EXPECT_PROD_HTML:-true}"
export PUBLIC_MEDIA_SMOKE_ENABLED="${PUBLIC_MEDIA_SMOKE_ENABLED:-true}"
export RUN_CATEGORY6_SMOKE="${RUN_CATEGORY6_SMOKE:-true}"

exec bash "${ROOT_DIR}/prod/deploy-prod.sh" deploy "$@"
