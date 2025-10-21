CREATE TABLE IF NOT EXISTS "ffmemes_promocodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ffmemes_products" ADD COLUMN "instant_buy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ffmemes_user" ADD COLUMN "referral_code" varchar(255);--> statement-breakpoint
ALTER TABLE "ffmemes_user" ADD COLUMN "referral_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ffmemes_user" ADD COLUMN "activated_codes" json;--> statement-breakpoint
ALTER TABLE "ffmemes_user" ADD COLUMN "used_codes" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ffmemes_promocodes" ADD CONSTRAINT "ffmemes_promocodes_user_id_ffmemes_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ffmemes_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
