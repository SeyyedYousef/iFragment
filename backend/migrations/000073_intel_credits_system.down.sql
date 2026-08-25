BEGIN;

DROP INDEX IF EXISTS idx_number_sales_tail_date;
DROP INDEX IF EXISTS idx_venue_snapshots_model_venue_updated;
DROP TABLE IF EXISTS intel_credit_ledger CASCADE;
DROP TABLE IF EXISTS intel_credit_batches CASCADE;

COMMIT;
