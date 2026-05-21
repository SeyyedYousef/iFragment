BEGIN;

CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT,
  language_code TEXT DEFAULT 'en',
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled','refunded')),
  payload TEXT UNIQUE NOT NULL,
  telegram_payment_charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE username_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  status TEXT NOT NULL,
  rarity_score INT NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_logs_username ON search_logs(username);
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);

CREATE INDEX idx_username_reports_username ON username_reports(username);
CREATE INDEX idx_username_reports_user_generated 
  ON username_reports(user_id, generated_at DESC);
CREATE INDEX idx_username_reports_data_gin ON username_reports USING GIN (report_data);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_payload_status ON orders(payload, status);

COMMIT;
