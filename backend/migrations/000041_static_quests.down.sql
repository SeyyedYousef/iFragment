BEGIN;

DELETE FROM quests WHERE key IN (
    'league_gold', 
    'join_clan', 
    'invite_1_fren', 
    'invite_3_frens', 
    'invite_10_frens', 
    'taps_100k', 
    'telegram_premium'
);

-- Note: join_ifragment_channel is kept as it was in previous migrations

COMMIT;
