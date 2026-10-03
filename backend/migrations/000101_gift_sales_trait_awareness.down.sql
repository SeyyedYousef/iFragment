-- 000101_gift_sales_trait_awareness.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_gift_sales_model_backdrop_serial;
DROP INDEX IF EXISTS idx_gift_sales_model_backdrop_date;

ALTER TABLE gift_sales DROP COLUMN IF EXISTS trait_rarity_score;
ALTER TABLE gift_sales DROP COLUMN IF EXISTS symbol_name;
ALTER TABLE gift_sales DROP COLUMN IF EXISTS backdrop_name;

COMMIT;
