-- 1. Create used_totp_codes table to prevent replay attacks
CREATE TABLE IF NOT EXISTS used_totp_codes (
    owner_telegram_id BIGINT NOT NULL,
    code_window      BIGINT NOT NULL,  -- unix_time / 30
    used_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_telegram_id, code_window)
);
CREATE INDEX IF NOT EXISTS idx_used_totp_used_at ON used_totp_codes(used_at);

-- 2. Enable pg_trgm extension and create GIN trigram indexes for high performance user search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_username_trgm  ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm  ON users USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id); -- B-Tree index for Telegram ID search

-- 3. Create optimized conditional index for active ban checks
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans (user_id) WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- 4. Clean up any stale backdoor default super admin user (Telegram ID: 12345)
DELETE FROM owner_roles WHERE telegram_user_id = 12345;
