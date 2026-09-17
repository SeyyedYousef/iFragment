-- 000091_phase0_p0_integrity_and_provenance.down.sql
BEGIN;

DROP INDEX IF EXISTS unq_gift_reports_user_gift;
ALTER TABLE number_sales DROP CONSTRAINT IF EXISTS chk_number_sales_price_positive;
ALTER TABLE gift_sales DROP CONSTRAINT IF EXISTS chk_gift_sales_serial_positive;
ALTER TABLE gift_sales DROP CONSTRAINT IF EXISTS chk_gift_sales_price_positive;

COMMIT;
