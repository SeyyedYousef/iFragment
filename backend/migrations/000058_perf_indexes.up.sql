-- Composite and performance indexes for iFragment core queries
CREATE INDEX IF NOT EXISTS idx_user_stats_xp_user_id ON user_stats(xp DESC, user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_lookup ON user_tasks(user_id, quest_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_clans_score ON clans(total_score DESC);
