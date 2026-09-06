-- Add chat_username to managed_channels table for robust username matching and funnel lookups
ALTER TABLE managed_channels ADD COLUMN IF NOT EXISTS chat_username TEXT;

-- Create index on lowercase username for fast lookups
CREATE INDEX IF NOT EXISTS idx_managed_channels_chat_username ON managed_channels (LOWER(chat_username)) WHERE chat_username IS NOT NULL;
