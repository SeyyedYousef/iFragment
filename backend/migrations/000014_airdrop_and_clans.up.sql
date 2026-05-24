BEGIN;

-- Add airdrop_coins to user_stats table
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS airdrop_coins DOUBLE PRECISION DEFAULT 0 NOT NULL;

-- Create clans table to link clans with Telegram Channels
CREATE TABLE IF NOT EXISTS clans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_channel_id BIGINT UNIQUE NOT NULL,
    channel_username TEXT UNIQUE NOT NULL,
    channel_photo TEXT,
    chat_title TEXT NOT NULL,
    members_count INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create clan_members mapping table
CREATE TABLE IF NOT EXISTS clan_members (
    clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
