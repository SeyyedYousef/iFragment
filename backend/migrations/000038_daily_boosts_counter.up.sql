BEGIN;

CREATE TABLE IF NOT EXISTS user_daily_boosts (
    user_id BIGINT NOT NULL,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    turbo_used SMALLINT NOT NULL DEFAULT 0,
    full_energy_used SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

COMMIT;
