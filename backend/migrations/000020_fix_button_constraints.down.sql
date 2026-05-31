BEGIN;

-- Drop the new constraint
ALTER TABLE channel_inline_buttons DROP CONSTRAINT IF EXISTS channel_inline_buttons_type_check;

-- Restore the original constraint list
ALTER TABLE channel_inline_buttons ADD CONSTRAINT channel_inline_buttons_type_check 
    CHECK (type IN ('url', 'counter', 'share', 'webapp', 'payment'));

COMMIT;
