BEGIN;

-- Restore 'counter' into the allowed types
ALTER TABLE channel_inline_buttons DROP CONSTRAINT IF EXISTS channel_inline_buttons_type_check;

ALTER TABLE channel_inline_buttons ADD CONSTRAINT channel_inline_buttons_type_check 
    CHECK (type IN ('url', 'callback', 'counter', 'share', 'webapp', 'payment'));

-- Add order_index column
ALTER TABLE channel_inline_buttons ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

COMMIT;
