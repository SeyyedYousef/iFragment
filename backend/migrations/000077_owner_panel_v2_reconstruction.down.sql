-- Migration 000069 Down

BEGIN;

DROP TABLE IF EXISTS ads_campaigns;

ALTER TABLE owner_roles DROP COLUMN IF EXISTS totp_enabled;
ALTER TABLE owner_roles DROP COLUMN IF EXISTS totp_enabled_at;
ALTER TABLE owner_roles DROP COLUMN IF EXISTS recovery_codes_hashes;
ALTER TABLE owner_roles DROP COLUMN IF EXISTS password_hash;

ALTER TABLE broadcasts DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS total_count;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS failed_count;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS started_at;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS completed_at;

ALTER TABLE system_settings DROP COLUMN IF EXISTS version;

ALTER TABLE managed_channels DROP COLUMN IF EXISTS credit_balance;
ALTER TABLE managed_groups DROP COLUMN IF EXISTS credit_balance;

ALTER TABLE impersonation_sessions DROP COLUMN IF EXISTS duration_seconds;

COMMIT;
