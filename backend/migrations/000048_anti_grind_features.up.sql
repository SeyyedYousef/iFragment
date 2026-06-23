BEGIN;

-- Add tapped_coins to track daily tap earnings
ALTER TABLE user_daily_boosts ADD COLUMN IF NOT EXISTS tapped_coins DOUBLE PRECISION DEFAULT 0 NOT NULL;

-- Add last_decay_at to track when coin decay was last applied
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_decay_at DATE;

-- Add index to speed up finding inactive users for coin decay
CREATE INDEX IF NOT EXISTS idx_user_stats_last_active_at ON user_stats(last_active_at);

COMMIT;
