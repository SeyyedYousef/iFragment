# Runbook: Upstream Provider Outage Handling (ING-P0-006, SLO-P1-001, DOD-P1-003)

## 1. Overview
This runbook guides operators during partial or complete outages of external data providers:
- **Telegram Fragment** (HTTP/Scraper / TonAPI)
- **TON Blockchain Indexers** (TonAPI, TON Center v3)
- **Telegram Gifts Market & Stars APIs** (api.changes.tg, Telegram MTProto/Bot API)
- **Crypto Rates** (Alternative.me, CoinGecko, CryptoCompare)

## 2. Guiding Principle: "Evidence First, Zero Synthesis"
Under no circumstances should synthetic prices, fake listings, sinusoidal chart curves, or arbitrary fallback numbers (e.g. 2450 TON, 1.42 USD) be served as live data during an outage. When upstream data is missing, the system MUST serve `data_status: "unavailable"` or `data_status: "stale"`.

## 3. Degradation States
- **Live (< 5m / < 30m):** Normal operation. All indicators green.
- **Delayed / Stale (30m – 6h):** Upstream unreachable, serving last known validated observations with `data_status: "stale"` and original `observed_at` preserved.
- **Unavailable (> 6h or no observations):** Service returns `data_status: "unavailable"`, numeric market fields as `null`, and empty collection items.

## 4. Operational Steps
1. **Identify Failing Provider:** Check `/api/v1/owner/health/metrics` or application logs for provider error codes (e.g. `429 Too Many Requests`, `503 Service Unavailable`, `context deadline exceeded`).
2. **Rate Limit Breaches (HTTP 429):**
   - If TonAPI returns 429: Confirm API key configuration in `TONAPI_KEY`. The client automatically backs off with exponential jitter.
3. **Provider Recovery:**
   - When upstream recovers, the indexers and scrapers resume from durable checkpoints in `indexer_checkpoints`.
   - Re-run verification suite: `go test ./internal/service/...`.
