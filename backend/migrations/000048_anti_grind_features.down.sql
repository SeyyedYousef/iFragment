BEGIN;

DROP INDEX IF EXISTS idx_user_stats_last_active_at;

ALTER TABLE user_stats DROP COLUMN IF EXISTS last_decay_at;

ALTER TABLE user_daily_boosts DROP COLUMN IF EXISTS tapped_coins;

COMMIT;
