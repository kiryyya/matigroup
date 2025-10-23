-- Remove ffmemes prefix from all tables
ALTER TABLE "ffmemes_cart_items" RENAME TO "cart_items";
ALTER TABLE "ffmemes_products" RENAME TO "products";
ALTER TABLE "ffmemes_promocodes" RENAME TO "promocodes";
ALTER TABLE "ffmemes_user" RENAME TO "user";

-- Update foreign key constraints
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "ffmemes_cart_items_user_id_ffmemes_user_id_fk";
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "promocodes" DROP CONSTRAINT IF EXISTS "ffmemes_promocodes_user_id_ffmemes_user_id_fk";
ALTER TABLE "promocodes" ADD CONSTRAINT "promocodes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
