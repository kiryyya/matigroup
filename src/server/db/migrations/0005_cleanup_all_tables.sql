-- Clean up all tables and start fresh
-- Drop all old tables with ffmemes prefix
DROP TABLE IF EXISTS "ffmemes_cart_items";
DROP TABLE IF EXISTS "ffmemes_products"; 
DROP TABLE IF EXISTS "ffmemes_user";
DROP TABLE IF EXISTS "ffmemes_promocodes";

-- Drop all product-related tables
DROP TABLE IF EXISTS "cart_items";
DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "promocodes";

-- Keep only the user table (this will be recreated by our schema)
-- All other functionality (products, cart, referrals, taps) has been removed
