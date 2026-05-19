BEGIN;

-- Add referral_code and referred_by to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL;

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    days_active INT NOT NULL DEFAULT 1,
    current_streak INT NOT NULL DEFAULT 1,
    total_taps INT NOT NULL DEFAULT 0,
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, achievement_id)
);

COMMIT;
