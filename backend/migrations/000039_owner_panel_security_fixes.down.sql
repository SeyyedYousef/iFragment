-- 1. Remove default seeded super admin user (if applicable)
DELETE FROM owner_roles WHERE telegram_user_id = 12345;

-- 2. Drop active ban optimized index
DROP INDEX IF EXISTS idx_user_bans_active;

-- 3. Drop GIN trigram and B-Tree indexes
DROP INDEX IF EXISTS idx_users_username_trgm;
DROP INDEX IF EXISTS idx_users_first_name_trgm;
DROP INDEX IF EXISTS idx_users_last_name_trgm;
DROP INDEX IF EXISTS idx_users_telegram_id;

-- 4. Drop used_totp_codes table
DROP TABLE IF EXISTS used_totp_codes;
