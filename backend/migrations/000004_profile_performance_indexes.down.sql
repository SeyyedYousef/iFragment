BEGIN;

DROP INDEX IF EXISTS idx_users_referred_by;
DROP INDEX IF EXISTS idx_users_referral_code;
DROP INDEX IF EXISTS idx_user_stats_xp;
DROP INDEX IF EXISTS idx_user_achievements_user;

COMMIT;
