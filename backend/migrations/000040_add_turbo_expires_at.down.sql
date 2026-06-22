BEGIN;
ALTER TABLE user_daily_boosts DROP COLUMN IF NOT EXISTS turbo_expires_at;
COMMIT;
