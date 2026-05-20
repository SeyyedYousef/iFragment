BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS emoji_status TEXT;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_border TEXT;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_skin TEXT;

CREATE TABLE IF NOT EXISTS user_cosmetics (
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    cosmetic_id TEXT NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, cosmetic_id)
);

COMMIT;
