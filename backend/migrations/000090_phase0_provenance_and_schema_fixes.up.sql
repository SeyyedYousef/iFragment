BEGIN;

-- 1. Fix missing runtime columns on number_features (RB-P0-010, MIG-P0-001, MIG-P0-005)
ALTER TABLE number_features ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE number_features ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_number_features_id ON number_features(id);
CREATE INDEX IF NOT EXISTS idx_number_features_restricted ON number_features(is_restricted);

-- 2. Quarantine & delete synthetic seeded rows from production tables (RB-P0-001, DEL-P0-001, MIG-P0-002)
DELETE FROM gift_sales 
WHERE buyer_address LIKE 'EQB...%' 
   OR seller_address LIKE 'EQC...%' 
   OR tx_hash LIKE '%_trade';

DELETE FROM market_listings 
WHERE listing_id LIKE 'frag_%_42' 
  AND buy_url LIKE 'https://fragment.com/gifts/%';

DELETE FROM gift_whale_wallets 
WHERE label IN (
    'Telegram Foundation Vault', 
    'Durov Sovereign Reserve', 
    'Fragment Liquidity Syndicate', 
    'TON Whales Alpha Fund', 
    'Smart Money Syndicate', 
    'Arbitrageur Vault #3'
);

DELETE FROM gift_arbitrage_opportunities 
WHERE source_url LIKE 'https://marketapp.ws/gifts/%'
   OR source_url LIKE 'https://mrkt.tg/gifts/%';

-- 3. Invalidate false real volume badge by default
ALTER TABLE venue_snapshots ALTER COLUMN has_real_volume_badge SET DEFAULT FALSE;
UPDATE venue_snapshots SET has_real_volume_badge = FALSE WHERE has_real_volume_badge = TRUE;

COMMIT;
