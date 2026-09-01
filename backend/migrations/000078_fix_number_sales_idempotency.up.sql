-- 000078_fix_number_sales_idempotency.up.sql
BEGIN;

-- 1. Deduplicate number_sales table by transaction_hash (keep lowest id)
DELETE FROM number_sales a USING number_sales b
WHERE a.id > b.id 
  AND a.transaction_hash = b.transaction_hash 
  AND a.transaction_hash IS NOT NULL 
  AND a.transaction_hash != '';

-- 2. Create unique index on transaction_hash to guarantee idempotency across indexer sweeps
CREATE UNIQUE INDEX IF NOT EXISTS unq_number_sales_tx_hash 
ON number_sales(transaction_hash) 
WHERE transaction_hash IS NOT NULL AND transaction_hash != '';

-- 3. Add index on owner_address for fast COUNT(DISTINCT owner_address) and wallet scan
CREATE INDEX IF NOT EXISTS idx_number_features_owner 
ON number_features(owner_address) 
WHERE owner_address IS NOT NULL AND owner_address != '';

-- 4. Add index on (user_id, number, purchased_at) for efficient 24h cache window checks
CREATE INDEX IF NOT EXISTS idx_number_reports_user_num_purchased 
ON number_reports(user_id, number, purchased_at DESC);

COMMIT;
