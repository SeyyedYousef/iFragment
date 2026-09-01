-- 000078_fix_number_sales_idempotency.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_number_reports_user_num_purchased;
DROP INDEX IF EXISTS idx_number_features_owner;
DROP INDEX IF EXISTS unq_number_sales_tx_hash;

COMMIT;
