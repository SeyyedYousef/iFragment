-- 000070_proliferation_fix_and_indexer_v2.up.sql

-- 1. Indexer Checkpoints table for restart-safe incremental syncing
CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    scope VARCHAR(64) PRIMARY KEY,
    cursor VARCHAR(255) NOT NULL DEFAULT '',
    last_seen_ts BIGINT NOT NULL DEFAULT 0,
    items_indexed BIGINT NOT NULL DEFAULT 0,
    lag_seconds BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Official Market Registry for Fragment contracts (address-based validation)
CREATE TABLE IF NOT EXISTS market_registry (
    address VARCHAR(128) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    market_type VARCHAR(64) NOT NULL DEFAULT 'auction', -- 'auction', 'sale', 'transfer'
    is_official BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed official known Fragment & marketplace addresses
INSERT INTO market_registry (address, name, market_type, is_official)
VALUES 
    ('EQA27W806y788s4p6n9d-2Mv8-26tA16174G2b99p1021464', 'Fragment Auction', 'auction', TRUE),
    ('EQD-cvR0Nz6XAyRBvbhz-PftCdRCmkyAcY1K2xsov1TDN9GM', 'Fragment Direct Sale', 'sale', TRUE),
    ('EQCjk1hh952vWaE9bRguF6Sl89JJNWGKn9Z0nqO2n1mqMz7q', 'Fragment', 'auction', TRUE),
    ('EQCkWxfyhAjaEyyQmgrTDqZX595NP2xYxBZaYFuCvuW_Y532', 'Getgems Deployer', 'sale', TRUE)
ON CONFLICT (address) DO UPDATE SET 
    name = EXCLUDED.name,
    market_type = EXCLUDED.market_type,
    is_official = EXCLUDED.is_official;

-- 3. Enhance sales table with market address, confidence rating, and indexing timestamp
ALTER TABLE sales ADD COLUMN IF NOT EXISTS market_address VARCHAR(128) DEFAULT '';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS price_confidence VARCHAR(32) DEFAULT 'exact';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sales_market_address ON sales(market_address);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date DESC);

-- 4. Dynamic Telegram Premium Gate Rules (replaces hardcoded group checks)
CREATE TABLE IF NOT EXISTS premium_gate_rules (
    chat_id BIGINT PRIMARY KEY,
    chat_title VARCHAR(255) DEFAULT '',
    require_premium BOOLEAN NOT NULL DEFAULT TRUE,
    note VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Enhance broadcasts table for the production broadcast worker
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS total_count INT NOT NULL DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS failed_count INT NOT NULL DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_broadcasts_status_scheduled ON broadcasts(status, scheduled_at);
