#!/usr/bin/env bash
# Idempotent schema safety patch for production.
# Single source of truth for deploy-time DB patches (instead of ad-hoc SQL in CI/deploy).
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

echo "Ensuring required tables/columns exist..."
psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
-- users
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "favorites" json DEFAULT '[]'::json;

UPDATE "user"
SET "favorites" = '[]'::json
WHERE "favorites" IS NULL;

-- categories
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "filters" json DEFAULT '[]'::json;

ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "background_image" varchar(500);

UPDATE "categories"
SET "filters" = '[]'::json
WHERE "filters" IS NULL;

-- projects
ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "attachments" json DEFAULT '[]'::json;

ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "filter_values" json DEFAULT '{}'::json;

ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "project_year" integer;

UPDATE "projects"
SET "attachments" = '[]'::json
WHERE "attachments" IS NULL;

UPDATE "projects"
SET "filter_values" = '{}'::json
WHERE "filter_values" IS NULL;

-- settings (watermark etc.)
CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(255) NOT NULL,
  "value" json NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_by" varchar(255)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_key_unique'
  ) THEN
    ALTER TABLE "settings" ADD CONSTRAINT "settings_key_unique" UNIQUE ("key");
  END IF;
END $$;
SQL

echo "Schema check/migration patch completed successfully."
