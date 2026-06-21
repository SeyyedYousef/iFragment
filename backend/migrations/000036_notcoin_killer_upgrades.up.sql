BEGIN;

-- 1. Completely Remove FRG Token Tables
DROP TABLE IF EXISTS frg_transactions CASCADE;
DROP TABLE IF EXISTS frg_balances CASCADE;

-- 2. Daily Cipher
CREATE TABLE IF NOT EXISTS daily_ciphers (
    cipher_date DATE PRIMARY KEY,
    morse_code TEXT NOT NULL,
    reward_coins DECIMAL(18,2) NOT NULL DEFAULT 1000000.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_cipher_claims (
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    cipher_date DATE REFERENCES daily_ciphers(cipher_date) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reward_amount DECIMAL(18,2) NOT NULL,
    PRIMARY KEY (user_id, cipher_date)
);

-- 3. Clans - Total Score for Leaderboard
ALTER TABLE clans ADD COLUMN IF NOT EXISTS total_score BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_clans_total_score ON clans(total_score DESC);

-- 4. Quest Engine Updates
-- Quests table already exists in earlier migrations (e.g., 000016 or similar).
-- We just need to make sure we support expiration.
ALTER TABLE quests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS a_b_test_group TEXT;

COMMIT;
