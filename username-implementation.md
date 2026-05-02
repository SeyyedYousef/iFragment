# Username Implementation Plan - iFragment

Implementing the Username section of iFragment to transform it from a mock UI into a 100/100 production-ready system.

## 📋 Overview
Following the technical audit report, we will implement the "Username" feature in four phases (A, B, C, D). This includes building a Go-based backend aggregator, integrating with TON blockchain data sources, and implementing Telegram Stars payments.

- **Project Type**: WEB (SolidJS) + BACKEND (Go)
- **Status**: 8/100 (Current) → 100/100 (Goal)

---

## 🎯 Success Criteria
- [ ] **Phase A Complete**: Working collection stats and live availability check.
- [ ] **Phase B Complete**: Premium reports with Telegram Stars payment integration.
- [ ] **Data Integrity**: Accurate data from Fragment, TonAPI, GetGems, and MarketApp.
- [ ] **Performance**: Backend caching (DragonflyDB) and optimized aggregator (Go errgroup).
- [ ] **UX/UI**: Flawless integration with the existing premium design, including i18n support.

---

## 🛠 Tech Stack
- **Backend**: Go 1.22+, Chi (Router), sqlc (DB), pgx (Postgres), DragonflyDB (Cache).
- **Frontend**: SolidJS, TanStack Query v5, Tailwind CSS, Motion One, Valibot.
- **Data Sources**: TonAPI.io, GetGems GraphQL, Fragment.com (Scraping/API), MarketApp.ws, Telegram Bot API.

---

## 📂 Proposed File Structure

### Backend
```plaintext
backend/
├── cmd/api/main.go               # Main entry point (Update)
├── internal/
│   ├── handler/                  # HTTP Handlers
│   │   ├── username_public.go    # Collection stats, Live check
│   │   └── username_premium.go   # Reports, Invoice creation
│   ├── service/                  # Business Logic
│   │   └── username/
│   │       ├── aggregator.go     # Data source aggregation
│   │       ├── rarity.go         # Rarity calculation logic
│   │       └── payment.go        # Telegram Stars logic
│   ├── client/                   # Third-party API clients
│   │   ├── fragment/             # Fragment.com client
│   │   ├── tonapi/               # TonAPI client
│   │   └── getgems/              # GetGems GraphQL client
│   ├── repository/               # Database access (sqlc)
│   │   ├── schema.sql            # Postgres migrations
│   │   └── query.sql             # SQL queries
│   └── middleware/               # Auth & InitData validation
```

### Frontend
```plaintext
frontend/src/
├── entities/username/
│   ├── api/                      # TanStack Query hooks
│   │   └── index.ts
│   └── ui/                       # New UI components
│       ├── UsernameCard.tsx
│       └── CollectionStats.tsx
├── pages/
│   ├── CollectionStatsPage/      # Free stats page
│   └── UsernameDetailsPage/      # Premium report page
```

---

## 📝 Task Breakdown

### Phase 0: Foundation & Infrastructure
- [ ] **Task 0.1**: Initialize Backend Structure (internal folders, base middleware).
- [ ] **Task 0.2**: Database Setup (PostgreSQL schema for reports & snapshots).
- [ ] **Task 0.3**: Caching Setup (DragonflyDB/Redis client).
- [ ] **Task 0.4**: Telegram InitData Validation Middleware.

### Phase A: Free MVP (Collection Stats & Live Check)
- [ ] **Task A.1**: Implement `TonAPI` and `GetGems` clients for collection stats.
- [ ] **Task A.2**: Backend Route: `GET /api/v1/usernames/collection/stats`.
- [ ] **Task A.3**: Live Availability Check Route (Debounced check against Fragment/t.me).
- [ ] **Task A.4**: Frontend: Create `CollectionStatsPage` and connect to API.
- [ ] **Task A.5**: Frontend: Fix Username Regex and connect live check to input.

### Phase B: Premium Reports & Telegram Stars
- [ ] **Task B.1**: Implement `Fragment.com` scraper/aggregator.
- [ ] **Task B.2**: Rarity Algorithm & Pricing Engine.
- [ ] **Task B.3**: Telegram Stars Invoice Integration (Backend).
- [ ] **Task B.4**: Premium Report Generation & Storage.
- [ ] **Task B.5**: Frontend: `UsernameDetailsPage` with charts and history.

### Phase C: Advanced Features & Polish
- [ ] **Task C.1**: Watchlist & Alerts (Stars subscription model).
- [ ] **Task C.2**: AI Valuation Model integration.
- [ ] **Task C.3**: Export Report as PDF/Image.

---

## ✅ Phase X: Verification
- [ ] **Security**: `python .agent/scripts/checklist.py .`
- [ ] **Performance**: `python .agent/skills/performance-profiling/scripts/lighthouse_audit.py`
- [ ] **E2E**: Playwright tests for the checkout flow.
- [ ] **RTL/i18n**: Verify all 4 languages.

## ✅ PHASE X COMPLETE
- Date: [Pending]
