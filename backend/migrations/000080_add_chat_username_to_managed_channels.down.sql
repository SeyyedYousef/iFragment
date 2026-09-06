DROP INDEX IF EXISTS idx_managed_channels_chat_username;
ALTER TABLE managed_channels DROP COLUMN IF EXISTS chat_username;
