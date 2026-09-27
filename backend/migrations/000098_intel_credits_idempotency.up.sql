-- 000098_intel_credits_idempotency.up.sql
BEGIN;

-- Add unique constraint on (source, reference_id) for intel_credit_batches to prevent race conditions during duplicate grants
CREATE UNIQUE INDEX IF NOT EXISTS uq_intel_credit_batches_source_ref 
    ON intel_credit_batches(source, reference_id) 
    WHERE reference_id IS NOT NULL;

COMMIT;
