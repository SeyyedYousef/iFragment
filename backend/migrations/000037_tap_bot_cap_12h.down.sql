BEGIN;

ALTER TABLE user_boosts ALTER COLUMN tap_bot_cap_seconds SET DEFAULT 10800;
UPDATE user_boosts SET tap_bot_cap_seconds = 10800 WHERE tap_bot_cap_seconds = 43200;

COMMIT;
