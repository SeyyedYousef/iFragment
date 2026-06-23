BEGIN;
ALTER TABLE user_boosts DROP COLUMN IF EXISTS tap_bot_cap_seconds;
COMMIT;
