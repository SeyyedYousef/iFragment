-- 000086_drop_channel_and_project_management.up.sql
-- Drop all Channel Management, Funnels, and Projects/Editorial tables, constraints, and partitions safely.

DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS content_revisions CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS pending_funnel_posts CASCADE;
DROP TABLE IF EXISTS channel_funnels CASCADE;
DROP TABLE IF EXISTS channel_post_clicks CASCADE;
DROP TABLE IF EXISTS channel_inline_buttons CASCADE;
DROP TABLE IF EXISTS channel_admins CASCADE;
DROP TABLE IF EXISTS channel_forwarding_rules CASCADE;
DROP TABLE IF EXISTS channel_analytics CASCADE;
DROP TABLE IF EXISTS channel_audit_logs CASCADE;
DROP TABLE IF EXISTS channel_billing_subscriptions CASCADE;
DROP TABLE IF EXISTS channel_settings CASCADE;
DROP TABLE IF EXISTS channel_posts CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS managed_channels CASCADE;
DROP TABLE IF EXISTS managed_userbots CASCADE;
