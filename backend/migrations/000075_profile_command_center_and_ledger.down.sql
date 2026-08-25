-- 000070_profile_command_center_and_ledger.down.sql
BEGIN;

DROP TABLE IF EXISTS user_ledger_events CASCADE;
DROP TABLE IF EXISTS user_emoji_rewards CASCADE;

COMMIT;
