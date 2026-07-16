BEGIN;

ALTER TABLE user_boosts DROP COLUMN IF EXISTS tap_bot_energy_snapshot;
ALTER TABLE user_boosts DROP COLUMN IF EXISTS tap_bot_daily_earned;
ALTER TABLE user_boosts DROP COLUMN IF EXISTS tap_bot_daily_reset_at;

COMMIT;
