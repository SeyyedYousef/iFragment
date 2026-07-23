# ADR-001: Technical Architecture & Stack Selection for iFragment

## Status
Accepted

## Date
2026-07-23

## Context
iFragment is a Telegram Mini App (TMA) and Web platform engineered for high-concurrency Telegram user interactions, fragment marketplace features, channel/group auto-response, and gamified airdrop systems.

Key requirements:
1. **Ultra-fast Frontend Rendering**: Must achieve 60-120fps inside Telegram In-App WebView without jank or Virtual DOM overhead.
2. **High-Concurrency Backend**: Must handle thousands of concurrent requests and webhooks from Telegram API and users with minimal RAM footprint.
3. **Data Integrity & Speed**: Transactional safety for user assets/balances alongside high-performance in-memory caching.
4. **Security & Authentication**: Cryptographic verification of Telegram `initData` and JWT session isolation between users and administrative accounts.

---

## Decision & Technical Stack

### 1. Frontend Architecture
- **Framework**: SolidJS (`solid-js`) for fine-grained reactivity and direct DOM manipulation without Virtual DOM overhead.
- **Build Tool**: Vite (`vite`) with TypeScript in strict mode.
- **Architecture Standard**: Feature-Sliced Design (FSD) separating `app`, `pages`, `widgets`, `features`, `entities`, and `shared`.
- **Styling**: Tailwind CSS v4 with curated dark/ambient themes and glassmorphism styling.
- **State & Data Fetching**: `@tanstack/solid-query` for declarative caching and optimistic UI updates.
- **Telegram Integration**: `@tma.js/sdk-solid` for native haptics, back-button, main-button, and theme synchronization.

### 2. Backend Architecture
- **Language**: Go 1.22+ (`golang`) utilizing native goroutines and lightweight concurrency primitives.
- **API Routing**: Clean Architecture with modular Go packages (`handler`, `service`, `repository`, `middleware`).
- **Primary Database**: PostgreSQL for relational storage, ACID compliance, and SQL integrity.
- **Data Access Layer**: `SQLC` for generating type-safe Go code directly from raw SQL queries.
- **Cache & Pub/Sub**: DragonflyDB (multi-threaded, high-throughput Redis alternative).

---

## Alternatives Considered

### Frontend: React / Next.js
- **Pros**: Large ecosystem and widespread developer familiarity.
- **Cons**: Virtual DOM reconciliation overhead causes frame drops inside constrained mobile WebViews; larger bundle sizes.
- **Rejected**: SolidJS provides identical JSX developer experience with zero Virtual DOM overhead and tiny bundle size.

### Backend: Node.js / Express or NestJS
- **Pros**: Single language across stack.
- **Cons**: Higher memory usage per connection, single-threaded event loop bottleneck under heavy webhook spikes.
- **Rejected**: Go provides superior CPU/memory efficiency and single-binary deployment.

---

## Consequences

- Direct DOM updates in SolidJS ensure instantaneous UI responsiveness in Telegram.
- DragonflyDB handles high-frequency session data without memory bottlenecks.
- SQLC eliminates ORM overhead and ensures 100% type safety between SQL and Go.
- `verify_all.py` and `checklist.py` master scripts maintain code quality across iterations.
