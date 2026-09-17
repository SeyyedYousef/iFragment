-- 000093_phase2_to_phase4_entitlements_and_observability.up.sql
BEGIN;

-- 1. Logical Assets Table (SCHEMA-P0-001)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical VARCHAR(32) NOT NULL,
    collection_id VARCHAR(128),
    canonical_key VARCHAR(128) NOT NULL,
    display_key VARCHAR(128) NOT NULL,
    chain_id VARCHAR(32) NOT NULL DEFAULT 'ton:mainnet',
    collection_address VARCHAR(128),
    item_address VARCHAR(128),
    gift_id VARCHAR(128),
    serial_num INTEGER,
    username_normalized VARCHAR(128),
    number_normalized VARCHAR(32),
    canonical_status VARCHAR(64) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    evidence_id UUID,
    CONSTRAINT uq_assets_vertical_canonical_key UNIQUE(vertical, canonical_key)
);
CREATE INDEX IF NOT EXISTS idx_assets_vertical_status ON assets(vertical, canonical_status);

-- 2. Raw & Parsed Observations Table (SCHEMA-P0-002)
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    collection_id VARCHAR(128),
    field_path VARCHAR(128) NOT NULL,
    value_json JSONB NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_name VARCHAR(64) NOT NULL,
    source_record_id VARCHAR(128),
    source_url TEXT,
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) NOT NULL DEFAULT 'live',
    method VARCHAR(64),
    parser_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    raw_payload_hash VARCHAR(64),
    ingestion_run_id UUID,
    is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
    is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_observation_synthetic CHECK (is_synthetic = FALSE OR status = 'synthetic')
);
CREATE INDEX IF NOT EXISTS idx_observations_asset_observed ON observations(asset_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source_name, source_record_id);

-- 3. Canonical Chain Events Table with Finality & Reorg Tracking (SCHEMA-P0-003)
CREATE TABLE IF NOT EXISTS chain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain VARCHAR(32) NOT NULL DEFAULT 'ton',
    network VARCHAR(32) NOT NULL DEFAULT 'mainnet',
    tx_hash VARCHAR(128) NOT NULL,
    block_hash VARCHAR(128),
    seqno BIGINT,
    lt BIGINT,
    event_index INTEGER NOT NULL DEFAULT 0,
    contract_address VARCHAR(128),
    item_address VARCHAR(128),
    event_type VARCHAR(64) NOT NULL,
    raw_trace_hash VARCHAR(128),
    decoder_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    confirmation_depth INTEGER NOT NULL DEFAULT 1,
    finality_status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
    reorged BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source_observation_id UUID,
    CONSTRAINT uq_chain_events_event UNIQUE(chain, network, tx_hash, event_index, decoder_version)
);
CREATE INDEX IF NOT EXISTS idx_chain_events_finality ON chain_events(finality_status, reorged);
CREATE INDEX IF NOT EXISTS idx_chain_events_item ON chain_events(item_address, lt DESC);

-- 4. Valuation Runs Table (SCHEMA-P0-006)
CREATE TABLE IF NOT EXISTS valuation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    model_version VARCHAR(32) NOT NULL,
    config_hash VARCHAR(64),
    input_snapshot_hash VARCHAR(64),
    output_json JSONB NOT NULL,
    uncertainty_json JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    persisted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    audit_persisted BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_valuation_runs_model ON valuation_runs(model_version, status);

-- 5. Report Entitlements Ledger (SCHEMA-P0-006, SEC-P0-002, RB-P0-005)
CREATE TABLE IF NOT EXISTS report_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id BIGINT NOT NULL,
    asset_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    product_type VARCHAR(64) NOT NULL,
    debit_ledger_id VARCHAR(128),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    snapshot_run_id UUID REFERENCES valuation_runs(id) ON DELETE SET NULL,
    CONSTRAINT uq_report_entitlements_principal_asset_idem UNIQUE(principal_id, asset_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_report_entitlements_lookup ON report_entitlements(principal_id, asset_id);

-- 6. Ingestion Dead Letter Queue (DLQ) & Source Health (ING-P1-005, ADD-P1-002)
CREATE TABLE IF NOT EXISTS ingestion_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(64) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_retry_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_source ON ingestion_dlq(source, created_at DESC);

COMMIT;
