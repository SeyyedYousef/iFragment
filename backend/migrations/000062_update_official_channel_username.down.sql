-- Rollback migration for 000062
UPDATE quests 
SET config = jsonb_set(config::jsonb, '{channel_username}', '"@ifragment_channel"')
WHERE key = 'join_ifragment_channel';
