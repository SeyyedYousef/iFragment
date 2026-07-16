BEGIN;

-- Add energy snapshot at time of going offline (for energy-gate check)
ALTER TABLE user_boosts ADD COLUMN IF NOT EXISTS tap_bot_energy_snapshot INT DEFAULT 0;

-- Add daily earning tracker for offline mining
ALTER TABLE user_boosts ADD COLUMN IF NOT EXISTS tap_bot_daily_earned DOUBLE PRECISION DEFAULT 0;

-- Add date tracker for daily earning reset
ALTER TABLE user_boosts ADD COLUMN IF NOT EXISTS tap_bot_daily_reset_at DATE DEFAULT CURRENT_DATE;

COMMIT;
