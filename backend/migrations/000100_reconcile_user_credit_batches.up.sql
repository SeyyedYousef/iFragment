-- 000100_reconcile_user_credit_batches.up.sql
BEGIN;

-- 1. Ensure user_credit_batches is the canonical source of coin truth.
-- Sync user_stats.airdrop_coins to equal the sum of remaining amounts of active unexpired coin batches.
UPDATE user_stats us
SET airdrop_coins = COALESCE(b.active_coins, 0.0)
FROM (
    SELECT user_id, COALESCE(SUM(remaining_amount), 0.0) as active_coins
    FROM user_credit_batches
    WHERE is_expired = FALSE 
      AND expires_at >= CURRENT_TIMESTAMP 
      AND remaining_amount > 0
    GROUP BY user_id
) b
WHERE us.user_id = b.user_id;

-- For any users who have no active batches, set airdrop_coins to 0.0 if not already 0.0
UPDATE user_stats
SET airdrop_coins = 0.0
WHERE user_id NOT IN (
    SELECT DISTINCT user_id 
    FROM user_credit_batches 
    WHERE is_expired = FALSE 
      AND expires_at >= CURRENT_TIMESTAMP 
      AND remaining_amount > 0
) AND airdrop_coins > 0.0;

COMMIT;
