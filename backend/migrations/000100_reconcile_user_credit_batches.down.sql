-- 000100_reconcile_user_credit_batches.down.sql
BEGIN;

-- No-op reversal: user balances reconciliation cannot be retroactively reversed without historical snapshots
SELECT 1;

COMMIT;
