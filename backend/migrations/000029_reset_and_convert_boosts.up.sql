BEGIN;

-- Reset all user boosts to default values (Multitap Level = 1, Energy Limit Level = 1, Tap Bot Level = 0)
UPDATE user_boosts 
SET multitap_level = 1, 
    energy_limit_level = 1, 
    tap_bot_level = 0;

COMMIT;
