BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, unlocked);

COMMIT;
