BEGIN;

-- Add offline mining tracking columns to user_boosts
ALTER TABLE user_boosts 
  ADD COLUMN IF NOT EXISTS tap_bot_last_collected_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tap_bot_cap_seconds INT DEFAULT 10800;

-- Create tap_audit table for anti-cheat logging
CREATE TABLE IF NOT EXISTS tap_audit (
  id BIGSERIAL,
  user_id BIGINT NOT NULL,
  taps INT NOT NULL,
  multiplier SMALLINT NOT NULL DEFAULT 1,
  nonce TEXT,
  client_ts TIMESTAMPTZ,
  server_ts TIMESTAMPTZ DEFAULT now(),
  ip INET,
  suspicious BOOLEAN DEFAULT false,
  PRIMARY KEY (id, server_ts)
) PARTITION BY RANGE (server_ts);

-- Create the first default partition
CREATE TABLE IF NOT EXISTS tap_audit_default PARTITION OF tap_audit DEFAULT;

-- Ensure indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tap_audit_user_id ON tap_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_tap_audit_suspicious ON tap_audit(suspicious) WHERE suspicious = true;

COMMIT;
