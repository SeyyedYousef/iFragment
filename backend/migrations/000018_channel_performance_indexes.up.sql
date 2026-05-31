-- Up Migration: Add high-performance composite indexes for channel management
CREATE INDEX IF NOT EXISTS idx_channel_audit_logs_query 
ON channel_audit_logs (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_analytics_query 
ON channel_analytics (channel_id, snapshot_date ASC);

CREATE INDEX IF NOT EXISTS idx_managed_channels_bot_lookup
ON managed_channels (bot_id, created_at DESC);
