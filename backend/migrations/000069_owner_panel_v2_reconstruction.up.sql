-- Migration 000069: Owner Panel V2 Reconstruction & Hardening

BEGIN;

-- 1. Owner Roles Enhancements (TOTP & Recovery Codes)
ALTER TABLE owner_roles ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE owner_roles ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
ALTER TABLE owner_roles ADD COLUMN IF NOT EXISTS recovery_codes_hashes TEXT[] DEFAULT '{}';
ALTER TABLE owner_roles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Ensure used_totp_codes exists
CREATE TABLE IF NOT EXISTS used_totp_codes (
    owner_telegram_id BIGINT NOT NULL,
    code_window      BIGINT NOT NULL,
    used_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_telegram_id, code_window)
);
CREATE INDEX IF NOT EXISTS idx_used_totp_used_at ON used_totp_codes(used_at);

-- 3. Dedicated Ads Campaigns Table
CREATE TABLE IF NOT EXISTS ads_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot VARCHAR(50) NOT NULL DEFAULT 'dashboard_banner',
    title VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255) DEFAULT '',
    image_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    impressions_count BIGINT NOT NULL DEFAULT 0,
    clicks_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_slot_active ON ads_campaigns(slot, is_active, priority DESC);

-- 4. Broadcasts Table Upgrades
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS total_count INT DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS failed_count INT DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_broadcasts_status_scheduled ON broadcasts(status, scheduled_at);

-- 5. System Settings Versioning for Optimistic Locking
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 6. Managed Channels & Groups credit balances
ALTER TABLE managed_channels ADD COLUMN IF NOT EXISTS credit_balance NUMERIC DEFAULT 0;
ALTER TABLE managed_groups ADD COLUMN IF NOT EXISTS credit_balance NUMERIC DEFAULT 0;

-- 7. Impersonation Sessions tracking
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;

COMMIT;
