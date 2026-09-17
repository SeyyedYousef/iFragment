# Runbook: Payment & Entitlement Ledger Reconciliation (SEC-P0-002, AC-P0-013, DOD-P1-003)

## 1. Overview
Ensures financial integrity across iFragment:
- User Airdrop coins & FRG balance deductions
- Intel Credits ledger consumption
- `report_entitlements` and `gift_reports` persistence

## 2. Invariant Principles
1. **Debit Leakage = 0:** No user balance deduction may succeed without an accompanying report or entitlement grant.
2. **Double Debit = 0:** Concurrent identical unlock requests must execute idempotently using `idempotency_key` or unique constraints.
3. **Owner Isolation = 100%:** Only the purchaser (`principal_id`) can view an unlocked report.

## 3. Daily Reconciliation Query
Execute daily check to verify that all deductions have corresponding reports/entitlements:
```sql
-- Check for orphan credit consumptions without entitlement
SELECT c.id, c.user_id, c.asset_id, c.consumed_at
FROM intel_credit_ledger c
LEFT JOIN report_entitlements e ON c.user_id = e.principal_id AND c.asset_id = e.asset_id
WHERE e.id IS NULL AND c.consumed_at < NOW() - INTERVAL '15 minutes';

-- Check for gift reports without valid purchase record
SELECT gr.report_id, gr.user_id, gr.gift_id, gr.purchased_at
FROM gift_reports gr
WHERE gr.user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM user_stats us WHERE us.user_id = gr.user_id
  );
```

## 4. Remediation
- If an orphan debit occurred due to an interrupted database transaction: Refund the user's credits/coins via `cfg.OwnerHandler.AdjustBalance` with audit reason `reconciliation_orphan_debit_refund`.
