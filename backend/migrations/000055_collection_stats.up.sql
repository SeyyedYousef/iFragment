CREATE TABLE IF NOT EXISTS nft_collection_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL UNIQUE,
    items_count TEXT NOT NULL,
    owners_count TEXT NOT NULL,
    floor_price TEXT NOT NULL,
    total_volume TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nft_collection_categories (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,
    category_name TEXT NOT NULL,
    volume TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_stat_date FOREIGN KEY (stat_date) REFERENCES nft_collection_stats (stat_date) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nft_collection_recent_auctions (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,
    item_name TEXT NOT NULL,
    price TEXT NOT NULL,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_stat_date FOREIGN KEY (stat_date) REFERENCES nft_collection_stats (stat_date) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_nft_coll_categories_date ON nft_collection_categories(stat_date);
CREATE INDEX IF NOT EXISTS idx_nft_coll_auctions_date ON nft_collection_recent_auctions(stat_date);
