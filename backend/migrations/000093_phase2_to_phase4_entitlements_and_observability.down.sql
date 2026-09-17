-- 000093_phase2_to_phase4_entitlements_and_observability.down.sql
BEGIN;

DROP TABLE IF EXISTS ingestion_dlq;
DROP TABLE IF EXISTS report_entitlements;
DROP TABLE IF EXISTS valuation_runs;
DROP TABLE IF EXISTS chain_events;
DROP TABLE IF EXISTS observations;
DROP TABLE IF EXISTS assets;

COMMIT;
