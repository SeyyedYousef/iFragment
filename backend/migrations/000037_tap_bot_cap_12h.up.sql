BEGIN;

ALTER TABLE user_boosts ALTER COLUMN tap_bot_cap_seconds SET DEFAULT 43200;
UPDATE user_boosts SET tap_bot_cap_seconds = 43200 WHERE tap_bot_cap_seconds = 10800;

COMMIT;
