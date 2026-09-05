# 📘 iFragment — Telegram Gifts Vertical: Full-Stack AI Architecture Specification & GV-Engine v6.0 Manual
> **Document Type:** AI Persistent Architecture Manual & Codebase Ground Truth  
> **Target Audience:** Autonomous AI Coding Agents & Engineers  
> **Last Synchronized:** 2026-09-05  
> **Workspace:** `iFragment` (Telegram Mini App — SolidJS + Go 1.25 + Postgres 17 + DragonflyDB + Telegram Bot API 9.4–10.3)  
> **Rule for Future AI Agents:** Whenever you modify, debug, or add features to Telegram Gifts (`internal/service/gifts/...`, `internal/repository/gifts_repo.go`, `backend/migrations/*_gifts*`, or `frontend/src/pages/gifts/*`), **YOU MUST READ THIS FILE FIRST** and **UPDATE THIS SPECIFICATION** to keep documentation in 100% sync with active code.

---

## 1. Executive Overview & Problem Statement

The **Telegram Gifts (گیفت‌های تلگرام)** vertical in iFragment is an institutional-grade valuation, analytics, and intelligence platform designed for Telegram collectible gifts, on-chain TEP-62 NFTs on the TON blockchain, and in-app Telegram Stars (XTR) marketplace assets.

### Key Capabilities:
1. **GV-Engine v6.0 (Realized-Anchored Quantum Hedonic AVM):** Automated Valuation Model delivering mathematically rigorous fair value estimates in GRAM (TON) and USD.
2. **Strict Hard Last-Sale & Floor Anchor Invariant:** Guaranteed pricing axiom where an asset's valuation **CAN NEVER BE LOWER THAN ITS LAST RECORDED TRANSACTION PRICE OR THE ACTIVE MARKETPLACE FLOOR**.
3. **Multi-Venue Real-Time Market Aggregation:** Ingestion of live order books, listings, and trade histories across 7 venues: Fragment (5%), Getgems (5%), MarketApp (2.5%), MRKT (0%), Portals (2.5%), Tonnel (3%), and official in-app Telegram Stars.
4. **DNA Attribute Scarcity & Chromatic Delta-E Scoring:** Decomposition of collectibles into 4 genetic axes (Model, Backdrop 4-HEX color palette, Symbol/Pattern, Serial number) with continuous logarithmic scarcity modeling and joint surprisal entropy ($I = -\log_2 P$).
5. **Dutch Auction Upgrade Ladder & Crafting Stochastic Forge:** Real-time advice on falling Telegram upgrade stairs ($1,000,000 \to 25$ Stars) and 10,000-trial Monte Carlo Expected Value (EV) simulations for gift crafting/burning.
6. **Provenance & On-Chain Explorer:** Full verification linking off-chain Telegram custody to on-chain TEP-62 smart contracts, TonViewer, TonScan, and ownership history.
7. **Curiosity Gate (Zero Price Leakage):** Strict pre-paywall teaser displaying signal counters, risk counts, and floor indicators without leaking fair value before user unlocks with credits or coins.

---

## 2. Full-Stack Architectural Blueprint

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (SolidJS + Vite)                            │
│  - GiftsIntelPage.tsx (Macro Charts, Collections Explorer, Global Heatmap)       │
│  - GiftCollectionPage.tsx (Deep Intelligence: Market, Sales, Items, Heatmap)    │
│  - GiftReportPage.tsx (3D Gyro Card, 10-Section Valuation Report, Guarantee)      │
│  - CraftingCalculatorPage.tsx (Stochastic EV Simulation & Slot Manager)          │
│  - PortfolioScannerPage.tsx (Rate-Limited Multi-Asset Inventory Audit)          │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ REST API / Axios
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (Go 1.25 HTTP API)                            │
│                                                                                  │
│  ┌────────────────────────┐    ┌───────────────────────┐    ┌─────────────────┐  │
│  │ GiftsHandler           │    │ VenueSnapshotWorker   │    │ DynamicCatalog  │  │
│  │ (Endpoints Controller) │    │ (Background Cron)     │    │ (api.changes.tg)│  │
│  └───────────┬────────────┘    └───────────┬───────────┘    └────────┬────────┘  │
│              │                             │                         │           │
│              ▼                             ▼                         │           │
│  ┌─────────────────────────────────────────────────────┐             │           │
│  │ GiftsService                                        │◄────────────┘           │
│  │ - Unlocking & Credit FIFO Consumption               │                         │
│  │ - Portfolio Scanner & Telegram Bot API Integration  │                         │
│  │ - Collection Intelligence & Aggregates              │                         │
│  └──────────────────────────┬──────────────────────────┘                         │
│                             │                                                    │
│                             ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ GV-Engine v6.0 (Valuation Core)                                            │  │
│  │ - 8-Axis Quantum Hedonic Prior (Floor, Model, Backdrop, Symbol, Serial, ..) │  │
│  │ - Historical Comparable Sales (Winsorized, Time-Decay λ=0.005)             │  │
│  │ - Bayesian Shrinkage (K=10)                                                │  │
│  │ - HARD LAST-SALE ANCHOR (Never below last sale or collection floor)        │  │
│  │ - Dynamic Uncertainty Bands (MAD-Calibrated)                               │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬────────────────────────────────────────────┘
                                      │ SQL Queries / Cache
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  STORAGE LAYER (PostgreSQL 17 + DragonflyDB)                     │
│  - `gift_collections` / `gift_traits` / `trait_supply_percentiles`                │
│  - `gift_sales` (Multi-venue realized historical trades)                         │
│  - `gift_valuations` (Mandatory audit logs with reasoning snapshot)              │
│  - `gift_reports` (24-hour purchased unlocked report cache)                      │
│  - `venue_snapshots` (Real-time floor & volume per venue)                       │
│  - DragonflyDB Keys: `gifts:intel:col:{slug}`, `gifts:portfolio:rl:{caller}`     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Data Models

All tables are defined in migration `backend/migrations/000072_telegram_gifts_vertical.up.sql`.

### 3.1 `gift_sales` (Realized Trades Ground Truth)
```sql
CREATE TABLE IF NOT EXISTS gift_sales (
    id                  BIGSERIAL PRIMARY KEY,
    gift_id             VARCHAR(64) NOT NULL, -- e.g. "plush_pepe-42"
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL DEFAULT 0,
    venue               VARCHAR(32) NOT NULL, -- 'fragment', 'getgems', 'tonnel', 'portals', 'mrkt', 'telegram_stars'
    currency            VARCHAR(16) NOT NULL DEFAULT 'GRAM',
    sale_price_raw      NUMERIC(18,4) NOT NULL,
    sale_price_gram     NUMERIC(18,4) NOT NULL,
    sale_price_usd      NUMERIC(18,4) NOT NULL,
    venue_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    price_confidence    VARCHAR(16) NOT NULL DEFAULT 'measured', -- 'exact', 'measured', 'estimated'
    sale_date           TIMESTAMPTZ NOT NULL,
    buyer_address       TEXT,
    seller_address      TEXT,
    tx_hash             TEXT,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_sales_gift_date ON gift_sales(gift_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_gift_sales_model_date ON gift_sales(model_id, sale_date DESC);
```

### 3.2 `gift_valuations` (Mandatory Audit Trail)
Every execution of `gvengine.Valuate()` persists an unalterable audit row with `reasoning_log` and `config_snapshot`.
```sql
CREATE TABLE IF NOT EXISTS gift_valuations (
    id                  BIGSERIAL PRIMARY KEY,
    gift_id             VARCHAR(64) NOT NULL,
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL,
    run_timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version       VARCHAR(64) NOT NULL,
    config_snapshot     JSONB NOT NULL DEFAULT '{}',
    gram_usd_rate       NUMERIC(18,4) NOT NULL,
    base_price_gram     NUMERIC(18,4) NOT NULL,
    low_gram            NUMERIC(18,4) NOT NULL,
    expected_gram       NUMERIC(18,4) NOT NULL,
    high_gram           NUMERIC(18,4) NOT NULL,
    confidence_score    SMALLINT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    price_basis         VARCHAR(64) NOT NULL DEFAULT 'trait_comps_shrunk_to_class',
    comparable_sale_ids BIGINT[] NOT NULL DEFAULT '{}',
    reasoning_log       JSONB NOT NULL DEFAULT '{}'
);
```

### 3.3 `venue_snapshots` (Cross-Market Floor Tracking)
```sql
CREATE TABLE IF NOT EXISTS venue_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL,
    venue               VARCHAR(32) NOT NULL,
    floor_price_raw     NUMERIC(18,4) NOT NULL,
    floor_price_gram    NUMERIC(18,4) NOT NULL,
    currency            VARCHAR(16) NOT NULL DEFAULT 'GRAM',
    volume_24h_gram     NUMERIC(18,4) NOT NULL DEFAULT 0,
    volume_7d_gram      NUMERIC(18,4) NOT NULL DEFAULT 0,
    active_listings     INT NOT NULL DEFAULT 0,
    venue_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    has_real_volume_badge BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_model_venue_snapshot UNIQUE (model_id, venue)
);
```

---

## 4. GV-Engine v6.0 Mathematical Valuation Architecture

### 4.1 The 8-Axis Hedonic Formulation
$$\ln P_{\text{prior}} = \beta_0 + \beta_{\text{model}} + \beta_{\text{backdrop}} + \beta_{\text{symbol}} + \beta_{\text{serial}} + \beta_{\text{original}} + \beta_{\text{aesthetic}} + \beta_{\text{synergy}} + \ln(\text{FnG})$$

1. **$\beta_0$ (Baseline Dynamic Floor):** $\beta_0 = \ln(\text{BaseFloor})$. Resolved dynamically from the lowest active listing in `venue_snapshots` or scarcity baseline tier.
2. **$\beta_{\text{model}}$ (Continuous Model Scarcity):**
   $$\beta_{\text{model}} = 0.22 \times \ln\left(\frac{100}{\max(\text{modelPct}, 0.05)}\right) \quad (\text{or } 0.85 \text{ for crafted-only outputs})$$
3. **$\beta_{\text{backdrop}}$ (Backdrop Permille Elasticity):**
   $$\beta_{\text{backdrop}} = 0.35 \times \ln\left(\frac{1000}{\max(\text{permille}, 5.0)}\right)$$
4. **$\beta_{\text{symbol}}$ (Symbol Scarcity Elasticity):**
   $$\beta_{\text{symbol}} = 0.12 \times \ln\left(\frac{1000}{\max(\text{symbolPermille}, 5.0)}\right)$$
5. **$\beta_{\text{serial}}$ (Serial Gravity & Sacred Milestones):**
   - $\#1 \to \beta = 1.45$ (approx $4.26\times$)
   - Top $3 \to \beta = 1.20 - (s-2) \times 0.08$
   - Single Digits $\#4-\#9 \to 1.05 \to 0.78$
   - Double Digits $\#10-\#99 \to 0.75 \to 0.40$
   - Repdigits ($77, 88, 777, 8888$) $\to +0.22$ bonus
   - Round hundreds/thousands $\to +0.10$ / $+0.15$
6. **$\beta_{\text{aesthetic}}$ (Delta-E Chromatic Contrast):** Monochromatic gold/emerald palettes and complementary hex contrasts evaluated in CIELAB color space.
7. **$\beta_{\text{synergy}}$ (Joint Statistical Rarity):** Multi-dimensional joint probability and information surprisal $I = -\log_2(P_{\text{joint}})$.

### 4.2 Bayesian Shrinkage with Comps
When historical comps exist:
- Time decay weighting: $w_i = e^{-\lambda \Delta t_i}$ with $\lambda = 0.005$
- Annualized appreciation: $15\%$ per annum applied to historical trades
- Effective sample size: $n_{\text{eff}} = \frac{(\sum w_i)^2}{\sum w_i^2}$
- Shrinkage formula:
  $$\ln P_{\text{final}} = \frac{n_{\text{eff}} \cdot \ln P_{\text{comps}} + K \cdot \ln P_{\text{prior}}}{n_{\text{eff}} + K} \quad (K = 10.0)$$

### 4.3 THE STRICT HARD LAST-SALE & FLOOR ANCHOR INVARIANT
> ⚠️ **CRITICAL RULE:** Under NO circumstance may the engine output a fair value lower than the last realized sale price of the exact item, or lower than the collection floor price!

```go
effectiveFloor := baseFloor
isLastSaleAnchored := false

if lastSaleRecord != nil && lastSaleRecord.SalePriceGRAM > 0 {
    lastSalePrice := lastSaleRecord.SalePriceGRAM
    // Account for annual market momentum if time elapsed
    elapsedYears := time.Since(lastSaleRecord.SaleDate).Hours() / (24.0 * 365.25)
    if elapsedYears > 0 {
        lastSalePrice *= math.Pow(1.15, elapsedYears)
    }
    if lastSalePrice > effectiveFloor {
        effectiveFloor = lastSalePrice
    }
    isLastSaleAnchored = true
}

// Hard Invariant Clamping:
if rawEstimateGRAM < effectiveFloor {
    rawEstimateGRAM = effectiveFloor
    if isLastSaleAnchored {
        priceBasis = "direct_last_sale_anchored"
    } else {
        priceBasis = "market_floor_guaranteed"
    }
}

// Invariant: Low bound never collapses below floor or 95% of last sale:
if isLastSaleAnchored && lowBound < lastSalePrice * 0.95 {
    lowBound = lastSalePrice * 0.95
}
if lowBound < baseFloor {
    lowBound = baseFloor
}
```

---

## 5. Multi-Venue Marketplaces & Aggregation

| Marketplace | Type | Protocol Fee | Currency | Data Mechanism |
|:---|:---|:---:|:---:|:---|
| **Fragment** | Official On-Chain (TON) | 5.0% | GRAM/TON | Direct HTML Scraper (`table-cell-value tm-value`) |
| **Getgems** | TON NFT Marketplace | 5.0% | GRAM/TON | Getgems Public REST API (`/nfts/floor-price/:slug`) |
| **Portals** | Mini App P2P | 2.5% | GRAM/Stars | Adapter integration |
| **MRKT** | Mini App | 0.0% | GRAM/TON | 0% Fee Arbitrage Venue |
| **MarketApp.ws** | Smart Contract Escrow | 2.5% | GRAM | REST API |
| **Tonnel Network** | Bot Orderbook | 3.0% | GRAM | Telegram orderbook |
| **Telegram Stars** | In-App Official | ~0.0% | Stars (XTR) | Dynamic In-App Parity Corridor ($0.019/Star) |

### Background Synchronization
`VenueSnapshotWorker` runs every 3 minutes, querying all active collections across adapters with a concurrency rate-limiter (6 workers) and upserting into `venue_snapshots`.

---

## 6. Dutch Auction & Crafting Mechanics

### 6.1 Upgrade Dutch Auction
- In Telegram, gift upgrades fall geometrically from an initial peak (e.g. 15,000 to 1,000,000 Stars) down to 25 Stars over a 48-hour cycle.
- `UpgradeAdvisor` calculates the exact stair steps, countdown timer, and advises whether the user should `WAIT` (to save Stars) or `UPGRADE_NOW` (if the bottom stair is active).

### 6.2 Crafting Stochastic Forge
- Crafting allows combining 1 to 4 gifts of the **EXACT SAME COLLECTION**.
- Official Telegram Odds Matrix:
  - 1 Gift: 25.0% chance
  - 2 Gifts: 45.0% chance
  - 3 Gifts: 65.0% chance
  - 4 Gifts: 85.0% chance
- **All input gifts are burned**. If the roll fails, output is 0.
- `CalculateCraftingEV()` runs a 10,000-iteration Monte Carlo simulation calculating P10, P50, P90, Net EV, and Kelly criterion capital allocation recommendation (`YES`, `RISKY`, `NO`).

---

## 7. Frontend Pages & Components Guide

1. **`GiftReportPage.tsx` (`/gifts/report?g={id}`):**
   - **State A (Pre-paywall):** Renders `UnifiedPaywallGate` using `getCuriosityGate`. Zero price leakage.
   - **State B (Unlocked):** Renders the 3D Holographic Gyro Card with gloss shimmer, live dynamic fair value, "Last Sale Protected" verification badge, on-chain provenance timeline, seller net proceeds calculator, and trait DNA bars.
2. **`GiftsIntelPage.tsx` (`/gifts/intel`):**
   - 3 primary tabs: Chart View, Collections Explorer, Global Heatmap.
3. **`GiftCollectionPage.tsx` (`/gifts/collection?c={slug}`):**
   - Deep collection analytics: Market pulse, sales history with pagination, items directory with on-sale filter, attributes breakdown, venues comparison, and joint rarity heatmap.
4. **`CraftingCalculatorPage.tsx` (`/gifts/crafting`):**
   - Interactive 4-slot forge calculator enforcing same-collection constraint.
5. **`PortfolioScannerPage.tsx` (`/gifts/portfolio?u={user}`):**
   - User gift inventory analysis with strict 10-minute rate limit per caller key and CSV export.

---

## 8. Critical Non-Negotiable Axioms for AI Coding Agents

1. **Axiom 1 (Last-Sale Floor Invariant):** Never allow a gift valuation to output an estimate below its last realized sale price or collection floor.
2. **Axiom 2 (Zero Price Leakage):** Never return fair value prices in curiosity gates or unauthenticated endpoints before paywall unlocking.
3. **Axiom 3 (Attribution Rule):** Every UI page consuming `api.changes.tg` or `cdn.changes.tg` must display `Thanks to @GiftChanges`.
4. **Axiom 4 (Slug Robustness):** Always support both kebab-case (`plush-pepe`) and snake_case (`plush_pepe`) when resolving collection models.
5. **Axiom 5 (Language Protocol):** User-facing responses to Seyyed Yousef must always be in Persian (Farsi), while code, variables, and documentation files remain in English.

---

## 9. Protocol for Future AI Sessions (Self-Updating Protocol)

Whenever you (the AI agent) make changes to any part of the Gifts vertical:
1. **Read this document first** before modifying code.
2. **Implement your changes** adhering to the invariants outlined here.
3. **Run automated verification tests:**
   ```bash
   cd backend && go test ./internal/service/gifts/...
   cd frontend && npm run build
   ```
4. **Update this document (`docs/TELEGRAM_GIFTS_AI_SPEC.md`):** Record new models, altered constants, new endpoints, or updated formulas.
5. **Commit the code and spec together.**
