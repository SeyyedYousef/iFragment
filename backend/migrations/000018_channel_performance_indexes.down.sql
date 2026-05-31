-- Down Migration: Rollback channel performance indexes
DROP INDEX IF EXISTS idx_channel_audit_logs_query;
DROP INDEX IF EXISTS idx_channel_analytics_query;
DROP INDEX IF EXISTS idx_managed_channels_bot_lookup;
