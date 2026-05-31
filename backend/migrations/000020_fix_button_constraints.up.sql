BEGIN;

-- Drop the old constraint
ALTER TABLE channel_inline_buttons DROP CONSTRAINT IF EXISTS channel_inline_buttons_type_check;

-- Add the new constraint allowing 'callback' buttons
ALTER TABLE channel_inline_buttons ADD CONSTRAINT channel_inline_buttons_type_check 
    CHECK (type IN ('url', 'callback', 'share', 'webapp', 'payment'));

COMMIT;
