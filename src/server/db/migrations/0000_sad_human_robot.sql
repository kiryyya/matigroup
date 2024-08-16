CREATE TABLE IF NOT EXISTS "ffmemes_cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ffmemes_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"price" integer NOT NULL,
	"stock" integer,
	"hidden" boolean DEFAULT false NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"description" text,
	"images" json,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ffmemes_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"email_verified" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"telegram_id" varchar(255) NOT NULL,
	"chat_id" varchar(255),
	"tap_count" integer DEFAULT 0 NOT NULL,
	"role" varchar(255) DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ffmemes_cart_items" ADD CONSTRAINT "ffmemes_cart_items_user_id_ffmemes_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ffmemes_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
