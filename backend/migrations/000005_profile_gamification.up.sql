BEGIN;

CREATE TABLE IF NOT EXISTS user_daily_claims (
    user_id bigint PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    last_claimed_at timestamp with time zone,
    streak int DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS user_tasks (
    user_id bigint REFERENCES users(telegram_id) ON DELETE CASCADE,
    task_key varchar(50) NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    PRIMARY KEY (user_id, task_key)
);

CREATE TABLE IF NOT EXISTS user_boosts (
    user_id bigint PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    multitap_level int DEFAULT 1 NOT NULL,
    energy_limit_level int DEFAULT 1 NOT NULL,
    tap_bot_level int DEFAULT 0 NOT NULL
);

COMMIT;
