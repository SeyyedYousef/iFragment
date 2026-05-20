BEGIN;

DROP TABLE IF EXISTS user_cosmetics;
ALTER TABLE user_stats DROP COLUMN IF EXISTS equipped_skin;
ALTER TABLE user_stats DROP COLUMN IF EXISTS equipped_border;
ALTER TABLE user_stats DROP COLUMN IF EXISTS emoji_status;
ALTER TABLE users DROP COLUMN IF EXISTS premium_until;

COMMIT;
