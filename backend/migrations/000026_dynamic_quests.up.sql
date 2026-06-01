BEGIN;

CREATE TABLE IF NOT EXISTS quests (
    key varchar(50) PRIMARY KEY,
    title varchar(255) NOT NULL,
    type varchar(50) NOT NULL, -- 'channel_join', 'quiz', 'referral', 'first_username_scan', 'register_first_bot'
    reward_frg double precision NOT NULL DEFAULT 0.0,
    reward_xp integer NOT NULL DEFAULT 0,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Seed dynamic quests cleanly to match previous hardcoded configurations
INSERT INTO quests (key, title, type, reward_frg, reward_xp, config) VALUES
('join_ifragment_channel', 'Join iFragment Official Channel', 'channel_join', 10000.0, 100, '{"channel_username": "@ifragment_channel"}'),
('first_username_scan', 'Scan your first Username', 'first_username_scan', 5000.0, 50, '{}'),
('register_first_bot', 'Register a Telegram Bot', 'register_first_bot', 15000.0, 150, '{}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
