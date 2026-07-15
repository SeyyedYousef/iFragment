CREATE TABLE IF NOT EXISTS daily_combos (
    id SERIAL PRIMARY KEY,
    active_date DATE UNIQUE NOT NULL,
    secret_word VARCHAR(255) NOT NULL,
    reward_amount BIGINT NOT NULL DEFAULT 500000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_daily_combo_claims (
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    combo_id INTEGER REFERENCES daily_combos(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, combo_id)
);
