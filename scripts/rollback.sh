#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/rollback.sh <app_version>

APP_VERSION="${1:-}"
if [ -z "$APP_VERSION" ]; then
  echo "Usage: $0 <app_version>"
  exit 1
fi

DEPLOY_DIR="${DEPLOY_DIR:-$(pwd)}"
ENV_DEPLOY_FILE="${ENV_DEPLOY_FILE:-.env.deploy}"

cd "$DEPLOY_DIR"

if [ ! -f "$ENV_DEPLOY_FILE" ]; then
  echo "$ENV_DEPLOY_FILE not found."
  exit 1
fi

if ! grep -q '^APP_IMAGE=' "$ENV_DEPLOY_FILE"; then
  echo "APP_IMAGE is missing in $ENV_DEPLOY_FILE"
  exit 1
fi

if grep -q '^APP_VERSION=' "$ENV_DEPLOY_FILE"; then
  sed -i "s|^APP_VERSION=.*|APP_VERSION=${APP_VERSION}|" "$ENV_DEPLOY_FILE"
else
  echo "APP_VERSION=${APP_VERSION}" >> "$ENV_DEPLOY_FILE"
fi

docker compose --env-file "$ENV_DEPLOY_FILE" pull app
docker compose --env-file "$ENV_DEPLOY_FILE" up -d app
docker compose --env-file "$ENV_DEPLOY_FILE" ps

echo "Rollback switched to version: ${APP_VERSION}"
