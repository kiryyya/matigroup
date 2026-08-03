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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -x "$SCRIPT_DIR/ensure-schema.sh" ]; then
  chmod +x "$SCRIPT_DIR/ensure-schema.sh" || true
fi

echo "Running database schema safety patch..."
"$SCRIPT_DIR/ensure-schema.sh" "$DEPLOY_DIR" .env.prod

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

print_disk_state() {
  echo "=== Disk usage ==="
  df -h || true
  docker system df || true
}

cleanup_light() {
  echo "Running light Docker cleanup..."
  docker image prune -f || true
  docker builder prune -f || true
}

cleanup_aggressive() {
  echo "Running aggressive Docker cleanup (images/containers only, never volumes)..."
  docker compose --env-file "$ENV_DEPLOY_FILE" rm -sf app || true
  docker container prune -f || true
  docker image prune -af || true
  docker builder prune -af || true
  # Do NOT prune volumes: Postgres/MinIO data lives there.
  docker system prune -af || true
}

retry_with_cleanup() {
  cmd="$1"
  max_attempts="${2:-3}"
  attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    echo "Attempt ${attempt}/${max_attempts}: ${cmd}"
    if eval "$cmd"; then
      return 0
    fi

    echo "Command failed: ${cmd}"
    print_disk_state
    cleanup_aggressive
    attempt=$((attempt + 1))
  done
  return 1
}

print_disk_state
cleanup_light

set_kv "APP_IMAGE" "$next_image" "$ENV_DEPLOY_FILE"
set_kv "APP_VERSION" "$APP_VERSION" "$ENV_DEPLOY_FILE"

echo "Pulling and starting new version..."
retry_with_cleanup "docker compose --env-file \"$ENV_DEPLOY_FILE\" pull app" 3
retry_with_cleanup "docker compose --env-file \"$ENV_DEPLOY_FILE\" up -d app" 3

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
  # Keep current version and latest; remove older tags for this repo.
  docker images "${next_image%%:*}" --format "{{.Tag}}" \
    | grep -Ev "^(${APP_VERSION}|latest)$" \
    | xargs -r -I{} docker rmi -f "${next_image%%:*}:{}" || true
  cleanup_light
  print_disk_state
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
