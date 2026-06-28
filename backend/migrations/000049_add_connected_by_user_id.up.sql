-- Add connected_by_user_id to managed_channels and managed_groups
-- This tracks WHO actually connected the entity, separate from bot.OwnerUserID (who owns the bot)

ALTER TABLE managed_channels ADD COLUMN IF NOT EXISTS connected_by_user_id BIGINT;
ALTER TABLE managed_groups ADD COLUMN IF NOT EXISTS connected_by_user_id BIGINT;

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_managed_channels_connected_by ON managed_channels (connected_by_user_id) WHERE connected_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_managed_groups_connected_by ON managed_groups (connected_by_user_id) WHERE connected_by_user_id IS NOT NULL;

-- Backfill: For channels, set connected_by_user_id from channel_admins where is_owner = true
UPDATE managed_channels mc
SET connected_by_user_id = (
    SELECT ca.telegram_id FROM channel_admins ca
    WHERE ca.channel_id = mc.id AND ca.is_owner = true
    LIMIT 1
)
WHERE mc.connected_by_user_id IS NULL;

-- Backfill: For channels without a channel_admins owner, fall back to bot owner
UPDATE managed_channels mc
SET connected_by_user_id = (
    SELECT mb.owner_user_id FROM managed_bots mb WHERE mb.id = mc.bot_id
)
WHERE mc.connected_by_user_id IS NULL;

-- Backfill: For groups, fall back to bot owner (since groups don't have channel_admins)
UPDATE managed_groups mg
SET connected_by_user_id = (
    SELECT mb.owner_user_id FROM managed_bots mb WHERE mb.id = mg.bot_id
)
WHERE mg.connected_by_user_id IS NULL;
