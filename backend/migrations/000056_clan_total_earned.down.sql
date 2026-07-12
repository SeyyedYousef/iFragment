BEGIN;

ALTER TABLE user_stats DROP COLUMN IF EXISTS total_coins_earned;

COMMIT;
