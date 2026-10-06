-- Migration 000102: Fragment Investors Leaderboard and Boost Tracking

CREATE TABLE IF NOT EXISTS fragment_investors_user_stats (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    photo_url TEXT DEFAULT '',
    message_count INT NOT NULL DEFAULT 0,
    boost_count INT NOT NULL DEFAULT 0,
    last_boost_reward_at TIMESTAMPTZ,
    last_boost_check_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fi_user_stats_messages 
    ON fragment_investors_user_stats (message_count DESC);

CREATE INDEX IF NOT EXISTS idx_fi_user_stats_boosts 
    ON fragment_investors_user_stats (boost_count DESC);

-- Backfill message_count from existing fragment_investors_raffle_tickets if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fragment_investors_raffle_tickets'
    ) THEN
        INSERT INTO fragment_investors_user_stats (user_id, username, first_name, message_count, updated_at)
        SELECT 
            user_id,
            MAX(username) as username,
            MAX(first_name) as first_name,
            COUNT(*)::INT as message_count,
            NOW() as updated_at
        FROM fragment_investors_raffle_tickets
        GROUP BY user_id
        ON CONFLICT (user_id) DO UPDATE SET
            message_count = EXCLUDED.message_count,
            username = COALESCE(NULLIF(EXCLUDED.username, ''), fragment_investors_user_stats.username),
            first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), fragment_investors_user_stats.first_name);
    END IF;
END $$;
