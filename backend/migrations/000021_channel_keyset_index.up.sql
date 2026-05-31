BEGIN;

-- Replace old lookup index with optimized compound keyset composite index
DROP INDEX IF EXISTS idx_managed_channels_bot_lookup;

CREATE INDEX IF NOT EXISTS idx_managed_channels_bot_keyset
ON managed_channels (bot_id, created_at DESC, id DESC);

COMMIT;
