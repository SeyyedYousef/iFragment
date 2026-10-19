-- 000107_production_schema_sync.up.sql
-- Synchronizes production schema with all active workers, userbot scrapers, alert preferences, and composite covering indexes.

BEGIN;

-- 1. Active Bids table required by bid-scraper & username collection worker
CREATE TABLE IF NOT EXISTS active_bids (
    username TEXT PRIMARY KEY,
    highest_bid_ton NUMERIC(18, 4) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_active_bids_last_seen ON active_bids(last_seen_at DESC);

-- 2. Restore managed_userbots table required by MTProto userbot scrapers and Owner Panel
CREATE TABLE IF NOT EXISTS managed_userbots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    channels_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_managed_userbots_status ON managed_userbots(status);

-- 3. Number Alert Preferences table for +888 Collection Smart Radar
CREATE TABLE IF NOT EXISTS number_alert_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    pattern_key VARCHAR(64) NOT NULL DEFAULT 'all',
    max_price_ton NUMERIC(18, 4) NOT NULL DEFAULT 3000,
    alert_on_listing BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_auction_end BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_floor_drop BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Drop any redundant/legacy duplicate indexes
DROP INDEX IF EXISTS idx_sales_momentum;
DROP INDEX IF EXISTS idx_username_sales_Date;

-- 5. Add high-performance composite & functional covering indexes for collection & profile hot paths
CREATE INDEX IF NOT EXISTS idx_username_sales_lower_date
    ON username_sales(LOWER(username), sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_gift_sales_model_date_desc
    ON gift_sales(model_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_desc
    ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS report_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id BIGINT NOT NULL,
    asset_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    product_type VARCHAR(64) NOT NULL,
    debit_ledger_id VARCHAR(128),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    snapshot_run_id TEXT,
    CONSTRAINT uq_report_entitlements_principal_asset_idem UNIQUE(principal_id, asset_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_report_entitlements_lookup ON report_entitlements(principal_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_report_entitlements_principal_product
    ON report_entitlements(principal_id, product_type, asset_id);

COMMIT;
