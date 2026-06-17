BEGIN;

-- Revert order_index column
ALTER TABLE channel_inline_buttons DROP COLUMN IF EXISTS order_index;

-- Revert 'counter' from the allowed types
ALTER TABLE channel_inline_buttons DROP CONSTRAINT IF EXISTS channel_inline_buttons_type_check;

ALTER TABLE channel_inline_buttons ADD CONSTRAINT channel_inline_buttons_type_check 
    CHECK (type IN ('url', 'callback', 'share', 'webapp', 'payment'));

COMMIT;
