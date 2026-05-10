-- 20260504_init_username_schema.sql
-- Database: PostgreSQL

BEGIN;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY, -- Telegram User ID
    first_name TEXT NOT NULL,
    last_name TEXT,
    username TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Username Reports Table
CREATE TABLE IF NOT EXISTS username_reports (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    status TEXT NOT NULL, -- 'available', 'auction', 'sold', etc.
    rarity_score INT DEFAULT 0,
    report_data JSONB NOT NULL, -- Full metadata (on-chain, market history, etc.)
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by username
CREATE INDEX IF NOT EXISTS idx_username_reports_username ON username_reports(username);
-- Index for user history
CREATE INDEX IF NOT EXISTS idx_username_reports_user_id ON username_reports(user_id);

-- 3. Rate Limiting Table (for higher security/persistence)
CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    request_count INT DEFAULT 0,
    last_request TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
