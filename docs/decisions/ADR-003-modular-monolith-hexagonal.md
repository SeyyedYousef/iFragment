# ADR-003: Architectural Paradigm — Modular Monolith with Hexagonal Bounded Contexts

## Status
Accepted

## Date
2026-09-19

## Context
iFragment started as a monolithic backend and SolidJS frontend. As features expanded across Usernames, Collectible Numbers (+888), Telegram Gifts, Airdrops, and Bot management, cross-boundary imports and shared interface buckets (`service/interfaces.go`) began eroding domain boundaries.

Prematurely migrating to microservices would introduce distributed transaction overhead, network latency, event consistency lag, and high operational complexity. Conversely, an unstructured monolith leads to entangled dependencies, difficult testing, and unverified data claims.

## Decision

### 1. Backend: Modular Monolith with Hexagonal Bounded Contexts
- **Architecture**: A single deployable Go binary (`modular monolith`), with strict compile-time package boundaries.
- **Bounded Contexts**:
  - `billing`: Exclusive owner of balance, credit deductions, orders, rate snapshots, and entitlements.
  - `username`: Exclusive owner of username identity, Fragment observations, and AVM valuation.
  - `collectible_number`: Exclusive owner of +888 grammar, registry, sales indexing, and NV valuation.
  - `gift`: Exclusive owner of gift catalog, serial/trait classifications, venue observations, and GV valuation.
  - `identity`: Exclusive owner of Telegram principal authentication, session management, and profile metadata.
  - `ingestion`: Exclusive owner of durable inbox, checkpoints, and dead-letter queues (DLQ).
  - `admin`: Exclusive owner of owner guards, TOTP, and audit logging.
- **Hexagonal Ports & Adapters**:
  - Ports are owned by the *consuming use case* (consumer-driven interfaces), not pooled in a global `interfaces.go`.
  - External dependencies (PostgreSQL, DragonflyDB, Telegram Bot API, TonAPI) are adapters implementing those ports.
  - Domain entities and business logic must not import database drivers, HTTP routers, or other domain packages.

### 2. Frontend: Enforced Feature-Sliced Design (FSD)
- **Hierarchy**: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.
- **Strict Import Rules**:
  - Lower layers must never import from higher layers (e.g. `shared` must NEVER import `entities` or `features`).
  - Cross-slice imports within the same layer are forbidden (slices interact through public `index.ts` APIs).
  - Data mapping occurs in entity/feature APIs with runtime validation (Valibot) before reaching UI components.

## Consequences
- **Positive**: High development velocity, single-binary deployments, strong transactional guarantees within PostgreSQL.
- **Positive**: Clean separation of concerns makes independent unit and integration testing straightforward.
- **Positive**: Paves the way for future microservice extraction *only if and when* independent scaling or team boundaries require it.
- **Negative**: Requires architectural vigilance and import linting to prevent boundary leakage.
