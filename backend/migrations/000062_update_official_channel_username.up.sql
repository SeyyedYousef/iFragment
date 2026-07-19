UPDATE quests 
SET config = jsonb_set(config::jsonb, '{channel_username}', '"@Fragmentscommunity"')
WHERE key = 'join_ifragment_channel' 
   OR (type = 'channel_join' AND (config->>'channel_username' = '@ifragment_channel' OR config->>'channel_username' = 'ifragment_channel' OR config->>'channel_username' = 'ifragment_net' OR config->>'channel_username' = '@ifragment_net'));
