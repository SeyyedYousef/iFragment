BEGIN;

-- Add notification timestamp to user_boosts to prevent repeat spam when tap bot capacity is reached
ALTER TABLE user_boosts ADD COLUMN IF NOT EXISTS tap_bot_notified_at TIMESTAMPTZ;

COMMIT;
