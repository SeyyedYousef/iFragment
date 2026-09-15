-- Migration 000088: Fragment Investors Daily Raffle System & Gift Draws

CREATE TABLE IF NOT EXISTS fragment_investors_raffle_tickets (
    id BIGSERIAL PRIMARY KEY,
    raffle_date DATE NOT NULL,
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    message_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fi_raffle_tickets_date_user 
    ON fragment_investors_raffle_tickets (raffle_date, user_id);

CREATE INDEX IF NOT EXISTS idx_fi_raffle_tickets_date 
    ON fragment_investors_raffle_tickets (raffle_date);

CREATE TABLE IF NOT EXISTS daily_gift_draws (
    id BIGSERIAL PRIMARY KEY,
    draw_date DATE NOT NULL UNIQUE,
    total_messages INT NOT NULL,
    total_participants INT NOT NULL,
    winner_user_id BIGINT NOT NULL,
    winner_username VARCHAR(255),
    winner_first_name VARCHAR(255),
    prize_usd NUMERIC(10, 2) NOT NULL,
    prize_stars INT NOT NULL,
    gift_id VARCHAR(255),
    gift_title VARCHAR(255),
    auto_sent BOOLEAN NOT NULL DEFAULT FALSE,
    lock_status VARCHAR(20) NOT NULL DEFAULT 'LOCKED',
    notified_owner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_gift_draws_winner 
    ON daily_gift_draws (winner_user_id);
