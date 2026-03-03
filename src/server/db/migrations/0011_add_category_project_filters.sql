ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "filters" json DEFAULT '[]'::json;
--> statement-breakpoint
ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "filter_values" json DEFAULT '{}'::json;

