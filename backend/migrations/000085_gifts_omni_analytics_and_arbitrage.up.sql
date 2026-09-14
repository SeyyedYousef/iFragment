-- 000085_gifts_omni_analytics_and_arbitrage.up.sql
BEGIN;

-- 1. Enhance gift_collections with rich analytical, holder, and market metrics
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS upgraded_count INT NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS availability_remains INT NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS is_auction BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS is_limited BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS unique_holders_count INT NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS ath_price_gram NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS ath_date TIMESTAMPTZ;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS atl_price_gram NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS atl_date TIMESTAMPTZ;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS volume_24h_gram NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS volume_7d_gram NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS volume_30d_gram NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS turnover_rate_24h NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS price_change_24h_pct NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS price_change_7d_pct NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_collections ADD COLUMN IF NOT EXISTS market_cap_usd NUMERIC(18,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gift_collections_slug ON gift_collections(slug);
CREATE INDEX IF NOT EXISTS idx_gift_collections_vol24h ON gift_collections(volume_24h_gram DESC);

-- 2. Enhance gift_traits with exact mathematical rarity score and supply
ALTER TABLE gift_traits ADD COLUMN IF NOT EXISTS rarity_score NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE gift_traits ADD COLUMN IF NOT EXISTS total_supply INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gift_traits_score ON gift_traits(model_id, rarity_score DESC);

-- 3. Cross-Venue Arbitrage Radar: Real-time price spread tracking
CREATE TABLE IF NOT EXISTS gift_arbitrage_opportunities (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL,
    source_venue        VARCHAR(32) NOT NULL,
    target_venue        VARCHAR(32) NOT NULL,
    source_floor_gram   NUMERIC(18,4) NOT NULL,
    target_floor_gram   NUMERIC(18,4) NOT NULL,
    gross_spread_gram   NUMERIC(18,4) NOT NULL,
    net_profit_gram     NUMERIC(18,4) NOT NULL,
    net_roi_pct         NUMERIC(8,2) NOT NULL,
    source_url          TEXT,
    target_url          TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_arbitrage_pair UNIQUE (model_id, source_venue, target_venue)
);

CREATE INDEX IF NOT EXISTS idx_arbitrage_profit ON gift_arbitrage_opportunities(net_profit_gram DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_roi ON gift_arbitrage_opportunities(net_roi_pct DESC);

-- 4. Smart Money & Whale Wallets: High-conviction gift holders
CREATE TABLE IF NOT EXISTS gift_whale_wallets (
    id                      BIGSERIAL PRIMARY KEY,
    wallet_address          VARCHAR(128) NOT NULL UNIQUE,
    label                   VARCHAR(64) NOT NULL DEFAULT 'Whale',
    gifts_count             INT NOT NULL DEFAULT 0,
    unique_collections      INT NOT NULL DEFAULT 0,
    total_est_value_gram    NUMERIC(18,4) NOT NULL DEFAULT 0,
    top_asset_name          VARCHAR(128),
    last_active_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whale_wallets_value ON gift_whale_wallets(total_est_value_gram DESC);
CREATE INDEX IF NOT EXISTS idx_whale_wallets_count ON gift_whale_wallets(gifts_count DESC);

COMMIT;
