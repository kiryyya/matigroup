#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${1:-$(pwd)}"
ENV_PROD_FILE="${2:-.env.prod}"

cd "$DEPLOY_DIR"

if [ ! -f "$ENV_PROD_FILE" ]; then
  echo "Schema check skipped: $ENV_PROD_FILE not found in $DEPLOY_DIR"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed on server. Install postgresql-client and retry deploy."
  exit 1
fi

db_url="$(grep '^DATABASE_URL=' "$ENV_PROD_FILE" | tail -n1 | cut -d'=' -f2- || true)"
if [ -z "$db_url" ]; then
  echo "DATABASE_URL is missing in $ENV_PROD_FILE"
  exit 1
fi

# Remove optional surrounding quotes to support both DATABASE_URL=value and DATABASE_URL="value".
db_url="${db_url%\"}"
db_url="${db_url#\"}"

echo "Ensuring required columns exist..."
psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "filters" json DEFAULT '[]'::json;

ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "filter_values" json DEFAULT '{}'::json;

UPDATE "categories"
SET "filters" = '[]'::json
WHERE "filters" IS NULL;

UPDATE "projects"
SET "filter_values" = '{}'::json
WHERE "filter_values" IS NULL;
SQL

echo "Schema check/migration patch completed successfully."
