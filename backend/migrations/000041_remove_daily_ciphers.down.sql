BEGIN;

CREATE TABLE IF NOT EXISTS daily_ciphers (
    cipher_date DATE PRIMARY KEY,
    morse_code TEXT NOT NULL,
    reward_coins DOUBLE PRECISION DEFAULT 1000000.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_cipher_claims (
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    cipher_date DATE REFERENCES daily_ciphers(cipher_date) ON DELETE CASCADE,
    reward_amount DOUBLE PRECISION NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, cipher_date)
);

COMMIT;
