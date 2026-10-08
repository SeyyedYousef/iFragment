-- Migration 000106: Reset October Leaderboard, message events log, and purge dummy screenshot users
-- Safe, idempotent, order-safe.

-- 1. Create message events log table to track exact message timestamps
CREATE TABLE IF NOT EXISTS fragment_investors_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL DEFAULT -1001972125896,
    user_id BIGINT NOT NULL,
    message_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fi_messages_user_created 
    ON fragment_investors_messages (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fi_messages_created 
    ON fragment_investors_messages (created_at);

-- 2. Purge dummy screenshot users (888000001 to 888000009)
DELETE FROM fragment_investors_user_stats 
WHERE user_id BETWEEN 888000001 AND 888000009;

-- 3. Reset all message counts so pre-October fake/inflated numbers are completely removed
UPDATE fragment_investors_user_stats 
SET message_count = 0;

-- 4. Count messages strictly from October 1st, 2026 (2026-10-01 00:00:00 UTC) onwards
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fragment_investors_raffle_tickets'
    ) THEN
        -- Backfill genuine messages from October 1st onwards into fragment_investors_messages
        INSERT INTO fragment_investors_messages (chat_id, user_id, message_id, created_at)
        SELECT chat_id, user_id, message_id, created_at
        FROM fragment_investors_raffle_tickets
        WHERE created_at >= '2026-10-01 00:00:00+00';

        -- Update message counts strictly from genuine October 1st messages
        UPDATE fragment_investors_user_stats s
        SET message_count = sub.cnt,
            updated_at = NOW()
        FROM (
            SELECT user_id, COUNT(*)::INT as cnt
            FROM fragment_investors_raffle_tickets
            WHERE created_at >= '2026-10-01 00:00:00+00'
            GROUP BY user_id
        ) sub
        WHERE s.user_id = sub.user_id;
    END IF;
END $$;

-- 5. Ensure all existing group members in stats have a corresponding base user in users table
-- This guarantees foreign key references in intel_credit_batches will succeed
INSERT INTO users (telegram_id, username, first_name, language_code, created_at, updated_at)
SELECT 
    s.user_id, 
    COALESCE(s.username, ''), 
    COALESCE(NULLIF(s.first_name, ''), 'Investor'), 
    'en', 
    NOW(), 
    NOW()
FROM fragment_investors_user_stats s
WHERE s.user_id NOT BETWEEN 888000001 AND 888000009
ON CONFLICT (telegram_id) DO UPDATE SET
    username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name);
