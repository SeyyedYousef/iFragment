-- Owner Roles table
CREATE TABLE IF NOT EXISTS owner_roles (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',  -- 'super_admin', 'admin', 'moderator', 'support'
  totp_secret TEXT NOT NULL,                  -- TOTP Secret key
  ip_whitelist TEXT[],                        -- Allowed IPs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Owner Audit Logs table
CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES owner_roles(telegram_user_id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,                 -- 'frg_adjust', 'block_user', 'impersonate', etc.
  target_user_id BIGINT,
  payload JSONB,                               -- Before/after state change representation
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_owner_time ON owner_audit_logs(owner_id, created_at DESC);

-- User Bans table
CREATE TABLE IF NOT EXISTS user_bans (
  user_id BIGINT PRIMARY KEY,
  ban_type VARCHAR(20) NOT NULL,                -- 'full', 'shadow', 'wallet_freeze'
  reason TEXT,
  banned_by BIGINT REFERENCES owner_roles(telegram_user_id) ON DELETE SET NULL,
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Impersonation Sessions table
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id BIGINT NOT NULL REFERENCES owner_roles(telegram_user_id) ON DELETE CASCADE,
  target_user_id BIGINT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  actions_taken JSONB DEFAULT '[]'::jsonb
);

-- Promo Codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(50) PRIMARY KEY,
  reward_amount FLOAT NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Promo Code Redemptions table
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) REFERENCES promo_codes(code) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, user_id)
);
