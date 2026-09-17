-- 000091_phase0_p0_integrity_and_provenance.up.sql
BEGIN;

-- 1. Check constraints on gift_sales to guarantee data validity (RB-P0-001, RB-P0-010, MIG-P0-002)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_gift_sales_price_positive'
    ) THEN 
        ALTER TABLE gift_sales ADD CONSTRAINT chk_gift_sales_price_positive CHECK (sale_price_raw > 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_gift_sales_serial_positive'
    ) THEN 
        ALTER TABLE gift_sales ADD CONSTRAINT chk_gift_sales_serial_positive CHECK (serial_number > 0);
    END IF;
END $$;

-- 2. Check constraints on number_sales to ensure valid sale prices
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_number_sales_price_positive'
    ) THEN 
        ALTER TABLE number_sales ADD CONSTRAINT chk_number_sales_price_positive CHECK (sale_price_ton > 0);
    END IF;
END $$;

-- 3. Idempotent uniqueness on gift_reports per (user_id, gift_id) for 24h caching
CREATE UNIQUE INDEX IF NOT EXISTS unq_gift_reports_user_gift ON gift_reports(user_id, gift_id);

COMMIT;
