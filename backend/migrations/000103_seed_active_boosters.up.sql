-- Migration 000103: Seed Active Group Boosters for @FragmentInvestors
-- Idempotent upsert of known boosters

INSERT INTO fragment_investors_user_stats (user_id, username, first_name, boost_count, last_boost_check_at, updated_at)
VALUES
    (5076130392, 'iamSeyyed', 'ꘜ ᴵ ᵃᵐ [ #Ｓｅｙｙｅｄ ]', 4, NOW(), NOW()),
    (155803740, 'will', 'will MM — @Retailer', 1, NOW(), NOW()),
    (5883848469, 'monster', 'Monster Read My Bio', 1, NOW(), NOW()),
    (363723276, 'ho4u_4ayu', '𝕎𝕚𝕝𝕝𝕪𝕎𝕠𝕟𝕜𝕒 | 𝟡𝟡𝟜𝟘.𝕥𝕠𝕟', 1, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE SET
    boost_count = GREATEST(fragment_investors_user_stats.boost_count, EXCLUDED.boost_count),
    username = COALESCE(NULLIF(EXCLUDED.username, ''), fragment_investors_user_stats.username),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), fragment_investors_user_stats.first_name),
    last_boost_check_at = NOW(),
    updated_at = NOW();
