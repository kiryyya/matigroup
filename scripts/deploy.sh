#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy.sh <app_version> [app_image]
#
# Example:
#   ./scripts/deploy.sh sha-0123456789abcdef ghcr.io/your-org/matigroup

APP_VERSION="${1:-}"
APP_IMAGE_ARG="${2:-}"

if [ -z "$APP_VERSION" ]; then
  echo "Usage: $0 <app_version> [app_image]"
  exit 1
fi

DEPLOY_DIR="${DEPLOY_DIR:-$(pwd)}"
ENV_DEPLOY_FILE="${ENV_DEPLOY_FILE:-.env.deploy}"
STATE_FILE="${STATE_FILE:-.last_good_version}"
CONTAINER_NAME="${CONTAINER_NAME:-matigroup-app}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-120}"

cd "$DEPLOY_DIR"

if [ ! -f docker-compose.yml ]; then
  echo "docker-compose.yml not found in $DEPLOY_DIR"
  exit 1
fi

if [ ! -f "$ENV_DEPLOY_FILE" ]; then
  echo "$ENV_DEPLOY_FILE not found. Create it from deploy.env.example first."
  exit 1
fi

if [ ! -f .env.prod ]; then
  echo ".env.prod not found. Create server runtime env file first."
  exit 1
fi

current_version="$(grep '^APP_VERSION=' "$ENV_DEPLOY_FILE" | cut -d'=' -f2- || true)"
current_image="$(grep '^APP_IMAGE=' "$ENV_DEPLOY_FILE" | cut -d'=' -f2- || true)"

if [ -z "$current_image" ] && [ -z "$APP_IMAGE_ARG" ]; then
  echo "APP_IMAGE is missing in $ENV_DEPLOY_FILE and not passed as argument."
  exit 1
fi

next_image="${APP_IMAGE_ARG:-$current_image}"

set_kv() {
  key="$1"
  value="$2"
  file="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo "Preparing deploy: image=${next_image}, version=${APP_VERSION}"
set_kv "APP_IMAGE" "$next_image" "$ENV_DEPLOY_FILE"
set_kv "APP_VERSION" "$APP_VERSION" "$ENV_DEPLOY_FILE"

echo "Cleaning up old Docker images to free space..."
# Удаляем неиспользуемые образы, оставляя только последние 2 версии
docker images --format "{{.Repository}}:{{.Tag}}" | grep "${next_image%%:*}" | grep -v "${APP_VERSION}" | tail -n +3 | xargs -r docker rmi -f || true
# Общая очистка неиспользуемых ресурсов (осторожно, не удаляет используемые)
docker system prune -f --filter "until=24h" || true

echo "Pulling and starting new version..."
docker compose --env-file "$ENV_DEPLOY_FILE" pull app
docker compose --env-file "$ENV_DEPLOY_FILE" up -d app

echo "Waiting for healthcheck..."
deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
healthy=0

while [ "$SECONDS" -lt "$deadline" ]; do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  if [ "$status" = "healthy" ] || [ "$status" = "none" ]; then
    healthy=1
    break
  fi
  sleep 3
done

if [ "$healthy" -eq 1 ]; then
  echo "$APP_VERSION" > "$STATE_FILE"
  echo "Deploy success: ${APP_VERSION}"
  docker compose --env-file "$ENV_DEPLOY_FILE" ps
  exit 0
fi

echo "Deploy failed. Rolling back..."
if [ -n "$current_version" ]; then
  set_kv "APP_VERSION" "$current_version" "$ENV_DEPLOY_FILE"
  docker compose --env-file "$ENV_DEPLOY_FILE" pull app
  docker compose --env-file "$ENV_DEPLOY_FILE" up -d app
  echo "Rollback done: ${current_version}"
else
  echo "No previous APP_VERSION found, rollback skipped."
fi

docker logs --tail 100 "$CONTAINER_NAME" || true
exit 1
