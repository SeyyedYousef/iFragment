BEGIN;

-- 1. Gift Collections: Catalog of official Telegram gift models and on-chain collections
CREATE TABLE IF NOT EXISTS gift_collections (
    model_id            VARCHAR(64) PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,
    total_supply        INT NOT NULL DEFAULT 0,
    crafted_flag        BOOLEAN NOT NULL DEFAULT FALSE,
    release_date        TIMESTAMPTZ,
    base_stars_price    INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_collections_crafted ON gift_collections(crafted_flag);

-- 2. Gift Traits: Model, Backdrop, and Symbol attribute supply and permilles
CREATE TABLE IF NOT EXISTS gift_traits (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL REFERENCES gift_collections(model_id) ON DELETE CASCADE,
    trait_type          VARCHAR(32) NOT NULL, -- 'model', 'backdrop', 'symbol'
    trait_name          VARCHAR(128) NOT NULL,
    permille            INT NOT NULL DEFAULT 0, -- Rarity permille from getStarGiftUpgradeAttributes
    backdrop_center     VARCHAR(16), -- Hex color e.g. #FF5733
    backdrop_edge       VARCHAR(16),
    backdrop_pattern    VARCHAR(16),
    backdrop_text       VARCHAR(16),
    craft_chance_permille INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_gift_trait UNIQUE (model_id, trait_type, trait_name)
);

CREATE INDEX IF NOT EXISTS idx_gift_traits_model_type ON gift_traits(model_id, trait_type);

-- 3. Trait Supply Percentiles: Exact rarity mapping derived directly from official supply
CREATE TABLE IF NOT EXISTS trait_supply_percentiles (
    trait_id            BIGINT PRIMARY KEY REFERENCES gift_traits(id) ON DELETE CASCADE,
    exact_percentile    NUMERIC(6,3) NOT NULL,
    rarity_tier         VARCHAR(32) NOT NULL DEFAULT 'Common', -- Common, Uncommon, Rare, Epic, Legendary
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Gift Sales: Multi-Venue sales records indexed from 6 marketplaces
CREATE TABLE IF NOT EXISTS gift_sales (
    id                  BIGSERIAL PRIMARY KEY,
    gift_id             VARCHAR(64) NOT NULL, -- e.g. "plushpepe-42"
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL DEFAULT 0,
    venue               VARCHAR(32) NOT NULL, -- 'fragment', 'getgems', 'tonnel', 'portals', 'mrkt', 'telegram_stars'
    currency            VARCHAR(16) NOT NULL DEFAULT 'GRAM',
    sale_price_raw      NUMERIC(18,4) NOT NULL,
    sale_price_gram     NUMERIC(18,4) NOT NULL,
    sale_price_usd      NUMERIC(18,4) NOT NULL,
    venue_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    price_confidence    VARCHAR(16) NOT NULL DEFAULT 'measured', -- 'exact', 'measured', 'estimated'
    sale_date           TIMESTAMPTZ NOT NULL,
    buyer_address       TEXT,
    seller_address      TEXT,
    tx_hash             TEXT,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_sales_gift_date ON gift_sales(gift_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_gift_sales_model_date ON gift_sales(model_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_gift_sales_venue_date ON gift_sales(venue, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_gift_sales_price_gram ON gift_sales(sale_price_gram DESC);

-- 5. Gift Valuations: Mandatory Audit Trail for every GV Engine valuation
CREATE TABLE IF NOT EXISTS gift_valuations (
    id                  BIGSERIAL PRIMARY KEY,
    gift_id             VARCHAR(64) NOT NULL,
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL,
    run_timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version       VARCHAR(64) NOT NULL,
    config_snapshot     JSONB NOT NULL DEFAULT '{}',
    gram_usd_rate       NUMERIC(18,4) NOT NULL,
    base_price_gram     NUMERIC(18,4) NOT NULL,
    low_gram            NUMERIC(18,4) NOT NULL,
    expected_gram       NUMERIC(18,4) NOT NULL,
    high_gram           NUMERIC(18,4) NOT NULL,
    confidence_score    SMALLINT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    price_basis         VARCHAR(64) NOT NULL DEFAULT 'trait_comps_shrunk_to_class',
    comparable_sale_ids BIGINT[] NOT NULL DEFAULT '{}',
    reasoning_log       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_gift_valuations_gift_ts ON gift_valuations(gift_id, run_timestamp DESC);

-- 6. Purchased Premium Gift Reports: 24h Caching
CREATE TABLE IF NOT EXISTS gift_reports (
    report_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    gift_id             VARCHAR(64) NOT NULL,
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL,
    fair_value_nano_gram BIGINT NOT NULL DEFAULT 0,
    confidence_score    INT NOT NULL DEFAULT 0,
    report_snapshot     JSONB NOT NULL,
    purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_reports_user ON gift_reports(user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_reports_gift ON gift_reports(gift_id);

-- 7. Gift Watchlist: Notification alerts strictly restricted to purchased reports
CREATE TABLE IF NOT EXISTS gift_watchlist (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    gift_id             VARCHAR(64) NOT NULL,
    alert_on_sale       BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_price_drop BOOLEAN NOT NULL DEFAULT TRUE,
    target_price_gram   NUMERIC(18,4),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_user_gift_watchlist UNIQUE (user_id, gift_id)
);

CREATE INDEX IF NOT EXISTS idx_gift_watchlist_user ON gift_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_watchlist_gift ON gift_watchlist(gift_id);

-- 8. Venue Snapshots: Aggregated live floor, 24h volume, 7d volume per venue per collection
CREATE TABLE IF NOT EXISTS venue_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL,
    venue               VARCHAR(32) NOT NULL,
    floor_price_raw     NUMERIC(18,4) NOT NULL,
    floor_price_gram    NUMERIC(18,4) NOT NULL,
    currency            VARCHAR(16) NOT NULL DEFAULT 'GRAM',
    volume_24h_gram     NUMERIC(18,4) NOT NULL DEFAULT 0,
    volume_7d_gram      NUMERIC(18,4) NOT NULL DEFAULT 0,
    active_listings     INT NOT NULL DEFAULT 0,
    venue_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    has_real_volume_badge BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_model_venue_snapshot UNIQUE (model_id, venue)
);

CREATE INDEX IF NOT EXISTS idx_venue_snapshots_model ON venue_snapshots(model_id);

-- 9. Model Calibration for Gifts Vertical
CREATE TABLE IF NOT EXISTS gift_model_calibrations (
    id                  BIGSERIAL PRIMARY KEY,
    scope               VARCHAR(32) NOT NULL DEFAULT 'gifts',
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    sample_size         INT NOT NULL DEFAULT 0,
    median_error_pct    NUMERIC(8,4) NOT NULL DEFAULT 0,
    within_band_pct     NUMERIC(8,4) NOT NULL DEFAULT 0,
    uncertainty_mult    NUMERIC(5,3) NOT NULL DEFAULT 1.000
);

COMMIT;
