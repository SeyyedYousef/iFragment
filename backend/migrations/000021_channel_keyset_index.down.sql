BEGIN;

-- Drop the new keyset index
DROP INDEX IF EXISTS idx_managed_channels_bot_keyset;

-- Restore the original lookup index
CREATE INDEX IF NOT EXISTS idx_managed_channels_bot_lookup
ON managed_channels (bot_id, created_at DESC);

COMMIT;
