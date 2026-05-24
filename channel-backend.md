# Plan: iFragment Channel Management Backend

This plan guides the implementation of the backend for the iFragment Channel Management system.

---

## 📋 Overview
Currently, the frontend has a stunning FSD-compliant interface with 12 channel screens, but the backend lacks dedicated channel endpoints, database models, or webhook event processing. This plan bridges that gap to achieve a perfect 100/100 score.

## 💻 Project Type
**BACKEND / FULL-STACK (Go + SolidJS)**

---

## 🎯 Success Criteria
1. Full database support for 12 frontend pages (channels list, connect, bio, inline buttons, responder, forwarding, audit logs, posting, settings, admins, and analytics).
2. Telegram Bot API webhook updates (`channel_post`, `edited_channel_post`, `chat_join_request`, `chat_member`) integrated into `webhook.go`.
3. Complete REST APIs in Go, fully documented via OpenAPI spec.
4. Eliminate all 8 security vulnerabilities identified in the audit report.
5. All mock data and `localStorage` in the frontend replaced with server-side API data.

---

## 🛠️ Tech Stack & Rationale
- **Go 1.21+:** Highly efficient concurrent runtime for processing high-throughput Telegram updates.
- **PostgreSQL:** ACID-compliant relational DB perfect for structured configuration, logs, and relationships.
- ** DragonflyDB / Redis:** High-performance caching and Redis Streams for the background publishing queue.
- **SolidJS:** Extremely fast reactive UI, mapping directly to our endpoints using Ark UI and Tailwind CSS v4.

---

## 📁 File Structure

```plaintext
iFragment/
├── backend/
│   ├── internal/
│   │   ├── handler/
│   │   │   ├── channel_handler.go           # [NEW] REST API handlers for channels
│   │   │   └── webhook.go                   # [MODIFY] Added channel webhook updates & fixes
│   │   ├── service/
│   │   │   └── channelmgmt/                 # [NEW]
│   │   │       ├── channel_service.go       # [NEW] Core channel management logic
│   │   │       └── channel_service_test.go  # [NEW] Unit tests for service layer
│   │   └── repository/
│   │       ├── chat_repo.go                 # [NEW] Combined/Renamed repository
│   │       ├── settings_repo.go             # [MODIFY] Adding channel-specific categories
│   │       └── audit_repo.go                # [MODIFY] Adding channel action categorization
│   └── migrations/
│       └── 000009_channel_management.up.sql # [NEW] DB migrations for channels
└── frontend/
    └── src/
        ├── shared/
        │   └── api/
        │       └── channel-management.ts    # [NEW] API services definitions
        └── pages/
            └── channel/
                └── ...                     # [MODIFY] Replace localStorage/mocks with API calls
```

---

## 📝 Task Breakdown

### 🔵 Phase 1: Database & Foundation (P0)
*   **Task 1.1: Database Migration Setup**
    *   *Agent:* `database-architect` | *Skill:* `database-design`
    *   *Input:* PostgreSQL migrations system.
    *   *Output:* Created `000009_channel_management.up.sql` containing chat table modification (polymorphic or separate) and tables for posts, buttons, rules, and dynamic bios.
    *   *Verify:* `migrate -path migrations/ -database ... up` runs without errors.
*   **Task 1.2: Repository Layer Refactoring**
    *   *Agent:* `database-architect` | *Skill:* `database-design`
    *   *Input:* Existing `bot_repo.go` and `settings_repo.go`.
    *   *Output:* Unified repository methods supporting channel operations, auto-responders, and custom templates.
    *   *Verify:* Unit tests in `internal/repository` pass successfully.

### 🔵 Phase 2: Webhooks & Services (P1)
*   **Task 2.1: Webhook Updates Expansion**
    *   *Agent:* `backend-specialist` | *Skill:* `api-patterns`
    *   *Input:* `webhook.go`
    *   *Output:* Add parsing and processing for `channel_post`, `edited_channel_post`, `chat_member`, and `chat_join_request`.
    *   *Verify:* Simulating Telegram updates using HTTP POST triggers correct handlers.
*   **Task 2.2: Channel Management Core Service**
    *   *Agent:* `backend-specialist` | *Skill:* `clean-code`
    *   *Input:* `channel_service.go` skeleton.
    *   *Output:* Implemented logic for connection/disconnection, post scheduling, responder rules, and dynamic bio.
    *   *Verify:* Unit test suite `channel_service_test.go` achieves >80% coverage.

### 🔵 Phase 3: REST API Layer (P1)
*   **Task 3.1: REST Endpoints Handlers**
    *   *Agent:* `backend-specialist` | *Skill:* `api-patterns`
    *   *Input:* `channel_handler.go`.
    *   *Output:* HTTP API endpoints mapped to Chi Router for all channel functions.
    *   *Verify:* API routing runs and outputs normalized JSON payloads.
*   **Task 3.2: Endpoint Protection & Validation**
    *   *Agent:* `security-auditor` | *Skill:* `security-and-hardening`
    *   *Input:* Auth middleware and handlers.
    *   *Output:* Added `ChannelOwnerOnly` ownership validation checks. Fixed CVSS vulnerabilities (S1-S8).
    *   *Verify:* Unauthorized requests to `/channels/{channelID}/...` yield 403 Forbidden.

### 🔵 Phase 4: Frontend Hookup (P2)
*   **Task 4.1: API Connection Client**
    *   *Agent:* `frontend-specialist` | *Skill:* `react-best-practices`
    *   *Input:* SolidJS app directory.
    *   *Output:* Added `shared/api/channel-management.ts` containing REST hooks.
    *   *Verify:* Frontend compiles without errors.
*   **Task 4.2: Replace Mocks & LocalStorage**
    *   *Agent:* `frontend-specialist` | *Skill:* `react-best-practices`
    *   *Input:* All 12 pages in `frontend/src/pages/channel`.
    *   *Output:* Complete integration of REST API, removing mock timers and `localStorage` from inline-buttons.
    *   *Verify:* Changing settings, scheduling a post, and saving buttons successfully updates the database.

---

## 🏁 Phase X: Verification Checklist
- [ ] Run security scan: `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`
- [ ] Run UX audit: `python .agent/skills/frontend-design/scripts/ux_audit.py .`
- [ ] Perform backend tests: `go test -v ./...`
- [ ] Run frontend lint: `pnpm run lint`
- [ ] Build production version: `npm run build`
