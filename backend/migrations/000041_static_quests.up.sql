BEGIN;

-- Delete old unnecessary dynamic tasks
DELETE FROM quests WHERE key IN ('first_username_scan', 'register_first_bot');

-- Insert the new authentic static tasks
INSERT INTO quests (key, title, type, reward_frg, reward_xp, config) VALUES
('league_gold', 'Reach Gold League', 'league_gold', 20000.0, 200, '{}'),
('join_clan', 'Join a Clan', 'join_clan', 10000.0, 100, '{}'),
('invite_1_fren', 'Invite 1 Fren', 'invite_1_fren', 5000.0, 50, '{}'),
('invite_3_frens', 'Invite 3 Frens', 'invite_3_frens', 20000.0, 200, '{}'),
('invite_10_frens', 'Invite 10 Frens', 'invite_10_frens', 100000.0, 1000, '{}'),
('taps_100k', 'Reach 100,000 Taps', 'taps_100k', 50000.0, 500, '{}'),
('telegram_premium', 'Telegram Premium', 'telegram_premium', 50000.0, 500, '{}'),
('join_ifragment_channel', 'Join Official Channel', 'channel_join', 10000.0, 100, '{"channel_username": "@ifragment_channel"}')
ON CONFLICT (key) DO UPDATE SET 
    title = EXCLUDED.title, 
    type = EXCLUDED.type, 
    reward_frg = EXCLUDED.reward_frg, 
    reward_xp = EXCLUDED.reward_xp, 
    config = EXCLUDED.config, 
    is_active = true;

COMMIT;
