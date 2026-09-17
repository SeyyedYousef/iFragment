# Runbook: Blockchain Reorg Invalidation & Reconciliation (ING-P0-004, AC-P0-011, DOD-P1-003)

## 1. Overview
In the event of a deep TON blockchain reorganization or invalidation of previously finalized transactions, affected transactions must be quarantined so they are excluded from volume, floor, and valuation comp calculations.

## 2. Detection
- Discrepancies between locally indexed transactions and canonical block explorers (TonScan, TonViewer).
- Log alerts indicating `reorg_detected` or duplicate/inconsistent event traces for identical logical assets.

## 3. Quarantining Reorged Transactions
Update the `is_reorged` flag in `number_sales`, `gift_sales`, and `chain_events` tables:
```sql
BEGIN;
UPDATE number_sales SET is_reorged = TRUE WHERE transaction_hash = '<affected_tx_hash>';
UPDATE gift_sales SET is_reorged = TRUE WHERE tx_hash = '<affected_tx_hash>';
UPDATE chain_events SET reorged = TRUE, finality_status = 'reorged' WHERE tx_hash = '<affected_tx_hash>';
COMMIT;
```

## 4. Checkpoint Rollback & Resync
If a block sequence was reorganized, roll back the durable checkpoint in `indexer_checkpoints`:
```sql
UPDATE indexer_checkpoints 
SET cursor = '<pre_reorg_cursor>', updated_at = NOW() 
WHERE scope = 'numbers_sales';
```
The sales indexer will restart from the safe pre-reorg watermark and reprocess valid canonical transactions without duplicating records (`ON CONFLICT DO NOTHING`).
