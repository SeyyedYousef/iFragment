-- 000083_gift_sales_idempotency_and_venues.up.sql
BEGIN;

-- 1. Add event_index and ton_usd_at_sale columns to gift_sales if they don't exist
ALTER TABLE gift_sales ADD COLUMN IF NOT EXISTS event_index INT NOT NULL DEFAULT 0;
ALTER TABLE gift_sales ADD COLUMN IF NOT EXISTS ton_usd_at_sale NUMERIC(18,4);

-- 2. Deduplicate existing records by (venue, tx_hash, event_index) keeping lowest id
DELETE FROM gift_sales a USING gift_sales b
WHERE a.id > b.id 
  AND a.venue = b.venue
  AND a.tx_hash = b.tx_hash 
  AND a.event_index = b.event_index
  AND a.tx_hash IS NOT NULL 
  AND a.tx_hash != '';

-- 3. Create unique index to guarantee idempotent indexer sweeps across all 7 venues
CREATE UNIQUE INDEX IF NOT EXISTS unq_gift_sales_venue_tx_event 
ON gift_sales(venue, tx_hash, event_index) 
WHERE tx_hash IS NOT NULL AND tx_hash != '';

-- 4. Create index on (model_id, serial_number, sale_date DESC) for sub-millisecond comps lookup
CREATE INDEX IF NOT EXISTS idx_gift_sales_model_serial_date 
ON gift_sales(model_id, serial_number, sale_date DESC);

COMMIT;
