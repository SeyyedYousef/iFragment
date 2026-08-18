BEGIN;

CREATE TABLE IF NOT EXISTS user_credit_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    remaining_amount DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL, -- 'taps', 'task', 'streak', 'referral', 'clan', 'initial'
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_expired BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_credit_batches_active 
    ON user_credit_batches(user_id, expires_at) 
    WHERE is_expired = FALSE AND remaining_amount > 0;

-- Migrate existing non-zero airdrop_coins into an initial 15-day batch for active users
INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
SELECT 
    user_id,
    airdrop_coins,
    airdrop_coins,
    'initial',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '15 days',
    FALSE
FROM user_stats
WHERE airdrop_coins > 0
ON CONFLICT DO NOTHING;

COMMIT;
