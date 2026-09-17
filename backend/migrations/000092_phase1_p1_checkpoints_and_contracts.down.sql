-- 000092_phase1_p1_checkpoints_and_contracts.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_orders_idempotency_key;
ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;

DROP INDEX IF EXISTS idx_gift_sales_venue_tx;
DROP INDEX IF EXISTS idx_gift_sales_not_reorged;
ALTER TABLE gift_sales DROP COLUMN IF EXISTS decoder_version;
ALTER TABLE gift_sales DROP COLUMN IF EXISTS is_reorged;

DROP INDEX IF EXISTS idx_number_sales_tx_hash;
DROP INDEX IF EXISTS idx_number_sales_not_reorged;
ALTER TABLE number_sales DROP COLUMN IF EXISTS decoder_version;
ALTER TABLE number_sales DROP COLUMN IF EXISTS is_reorged;

COMMIT;
