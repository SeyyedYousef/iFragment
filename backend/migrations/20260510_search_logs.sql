-- Search popularity tracking (for search_popularity field)
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_logs_username ON search_logs(username);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at);
