BEGIN;

-- Drop the old constraint
ALTER TABLE frg_transactions DROP CONSTRAINT IF EXISTS frg_transactions_type_check;

-- Re-create the constraint with the expanded transaction types
ALTER TABLE frg_transactions ADD CONSTRAINT frg_transactions_type_check CHECK (
    type IN (
        'purchase_stars', 'purchase_toncoin', 'airdrop_convert',
        'subscription_payment', 'refund', 'admin_credit',
        'daily_claim', 'task_reward', 'boost_purchase', 
        'cosmetic_purchase', 'referral_payout', 'referral_revenue'
    )
);

COMMIT;
