-- Remove referral and promocode fields and tables
ALTER TABLE "user" DROP COLUMN IF EXISTS "referral_code";
ALTER TABLE "user" DROP COLUMN IF EXISTS "referral_count";
ALTER TABLE "user" DROP COLUMN IF EXISTS "activated_codes";
ALTER TABLE "user" DROP COLUMN IF EXISTS "used_codes";
ALTER TABLE "user" DROP COLUMN IF EXISTS "tap_count";

-- Drop promocodes table
DROP TABLE IF EXISTS "promocodes";
