CREATE TABLE chat_trial_history (
    chat_id BIGINT PRIMARY KEY,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
