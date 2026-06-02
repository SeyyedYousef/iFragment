-- Optimize starts_with queries on orders payload under high concurrency
CREATE INDEX IF NOT EXISTS idx_orders_payload_pattern ON orders(payload text_pattern_ops, status);
