BEGIN;

ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_coins_earned DOUBLE PRECISION DEFAULT 0 NOT NULL;

-- Initialize total_coins_earned with current airdrop_coins so existing players do not lose their accumulated rank
UPDATE user_stats SET total_coins_earned = airdrop_coins WHERE total_coins_earned = 0;

COMMIT;
