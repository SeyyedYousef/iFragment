BEGIN;

ALTER TABLE quests ADD COLUMN IF NOT EXISTS parent_key varchar(50) REFERENCES quests(key) ON DELETE CASCADE;

-- Create index for faster parent queries
CREATE INDEX IF NOT EXISTS idx_quests_parent_key ON quests(parent_key);

COMMIT;
