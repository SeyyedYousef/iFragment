DROP INDEX IF EXISTS idx_managed_channels_connected_by;
DROP INDEX IF EXISTS idx_managed_groups_connected_by;
ALTER TABLE managed_channels DROP COLUMN IF EXISTS connected_by_user_id;
ALTER TABLE managed_groups DROP COLUMN IF EXISTS connected_by_user_id;
