BEGIN;

DROP TABLE IF EXISTS tap_audit CASCADE;

ALTER TABLE user_boosts 
  DROP COLUMN IF EXISTS tap_bot_last_collected_at,
  DROP COLUMN IF EXISTS tap_bot_cap_seconds;

COMMIT;
