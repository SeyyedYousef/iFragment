BEGIN;
ALTER TABLE user_boosts DROP COLUMN IF EXISTS tap_bot_last_collected_at;
COMMIT;
