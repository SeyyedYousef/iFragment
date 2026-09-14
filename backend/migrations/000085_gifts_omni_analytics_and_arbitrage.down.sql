-- 000085_gifts_omni_analytics_and_arbitrage.down.sql
BEGIN;

DROP TABLE IF EXISTS gift_whale_wallets;
DROP TABLE IF EXISTS gift_arbitrage_opportunities;

ALTER TABLE gift_traits DROP COLUMN IF EXISTS rarity_score;
ALTER TABLE gift_traits DROP COLUMN IF EXISTS total_supply;

ALTER TABLE gift_collections DROP COLUMN IF EXISTS slug;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS upgraded_count;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS availability_remains;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS is_auction;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS is_limited;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS unique_holders_count;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS ath_price_gram;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS ath_date;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS atl_price_gram;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS atl_date;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS volume_24h_gram;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS volume_7d_gram;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS volume_30d_gram;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS turnover_rate_24h;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS price_change_24h_pct;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS price_change_7d_pct;
ALTER TABLE gift_collections DROP COLUMN IF EXISTS market_cap_usd;

COMMIT;
