BEGIN;

ALTER TABLE frg_transactions DROP CONSTRAINT IF EXISTS frg_transactions_type_check;

ALTER TABLE frg_transactions ADD CONSTRAINT frg_transactions_type_check CHECK (
    type IN (
        'purchase_stars', 'purchase_toncoin', 'airdrop_convert',
        'subscription_payment', 'refund', 'admin_credit'
    )
);

COMMIT;
