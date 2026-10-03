-- 000101_gift_sales_trait_awareness.up.sql
BEGIN;

-- 1. Add trait awareness columns to gift_sales
ALTER TABLE gift_sales ADD COLUMN IF NOT EXISTS backdrop_name VARCHAR(128);
ALTER TABLE gift_sales ADD COLUMN IF NOT EXISTS symbol_name VARCHAR(128);
ALTER TABLE gift_sales ADD COLUMN IF NOT EXISTS trait_rarity_score NUMERIC(5,2);

-- 2. Indexes for fast trait-aware comps queries
CREATE INDEX IF NOT EXISTS idx_gift_sales_model_backdrop_date 
ON gift_sales(model_id, backdrop_name, sale_date DESC) 
WHERE backdrop_name IS NOT NULL AND backdrop_name != '';

CREATE INDEX IF NOT EXISTS idx_gift_sales_model_backdrop_serial 
ON gift_sales(model_id, backdrop_name, serial_number) 
WHERE backdrop_name IS NOT NULL AND backdrop_name != '';

COMMIT;
