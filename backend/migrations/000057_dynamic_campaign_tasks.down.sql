BEGIN;

DROP INDEX IF EXISTS idx_quests_parent_key;
ALTER TABLE quests DROP COLUMN IF EXISTS parent_key;

COMMIT;
