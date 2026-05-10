-- Migration: 20260504_create_username_schema
-- Description: Create users, rate_limit, and username_reports tables

CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limit (
    ip_address INET PRIMARY KEY,
    request_count INT DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS username_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(telegram_id),
    username TEXT NOT NULL,
    status TEXT NOT NULL,
    rarity_score INT NOT NULL,
    report_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_username_reports_username ON username_reports(username);
CREATE INDEX IF NOT EXISTS idx_username_reports_user_id ON username_reports(user_id);
