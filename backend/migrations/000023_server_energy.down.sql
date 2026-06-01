BEGIN;

ALTER TABLE user_stats 
    DROP COLUMN IF EXISTS energy,
    DROP COLUMN IF EXISTS energy_updated_at;

DROP INDEX IF EXISTS idx_users_referred_by;

COMMIT;
