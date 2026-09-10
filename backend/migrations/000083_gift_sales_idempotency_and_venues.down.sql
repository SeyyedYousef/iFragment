-- 000083_gift_sales_idempotency_and_venues.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_gift_sales_model_serial_date;
DROP INDEX IF EXISTS unq_gift_sales_venue_tx_event;

ALTER TABLE gift_sales DROP COLUMN IF EXISTS ton_usd_at_sale;
ALTER TABLE gift_sales DROP COLUMN IF EXISTS event_index;

COMMIT;
