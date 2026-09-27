-- 000098_intel_credits_idempotency.down.sql
BEGIN;

DROP INDEX IF EXISTS uq_intel_credit_batches_source_ref;

COMMIT;
