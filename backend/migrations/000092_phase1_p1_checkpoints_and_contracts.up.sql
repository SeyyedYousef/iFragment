-- 000092_phase1_p1_checkpoints_and_contracts.up.sql
BEGIN;

-- 1. Number Sales provenance & reorg handling (MIG-P1-002, ADD-P1-001)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'number_sales' AND column_name = 'is_reorged'
    ) THEN 
        ALTER TABLE number_sales ADD COLUMN is_reorged BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'number_sales' AND column_name = 'decoder_version'
    ) THEN 
        ALTER TABLE number_sales ADD COLUMN decoder_version VARCHAR(32) NOT NULL DEFAULT 'v1';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_number_sales_not_reorged ON number_sales(number) WHERE is_reorged = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_number_sales_tx_hash ON number_sales(transaction_hash) WHERE transaction_hash IS NOT NULL AND transaction_hash != '';

-- 2. Gift Sales provenance & reorg handling (MIG-P1-002, ADD-P1-001)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gift_sales' AND column_name = 'is_reorged'
    ) THEN 
        ALTER TABLE gift_sales ADD COLUMN is_reorged BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gift_sales' AND column_name = 'decoder_version'
    ) THEN 
        ALTER TABLE gift_sales ADD COLUMN decoder_version VARCHAR(32) NOT NULL DEFAULT 'v1';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_sales_not_reorged ON gift_sales(gift_id) WHERE is_reorged = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_sales_venue_tx ON gift_sales(venue, tx_hash) WHERE tx_hash IS NOT NULL AND tx_hash != '';

-- 3. Idempotency support for Orders (MIG-P1-004)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'idempotency_key'
    ) THEN 
        ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(128);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key 
        ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
    END IF;
END $$;

COMMIT;
