# username_feature_full_implementation.md

## Goal
Transform the **Username** feature into a 100 % production‑ready, globally‑optimal component (frontend + backend + DB) that meets the best practices up to **6 May 2026**.

## Scope (all items have equal weight)
| Area | Tasks |
|------|-------|
| **Frontend UI / UX** | • Refactor `ActionArea.tsx` – remove glassmorphism, eliminate purple, use sharp geometry & bold cyan/green/red palette.  
• Add `aria‑label`s, keyboard focus handling, `role="search"`.  
• Ensure micro‑animations use `transform`/`opacity` only.  
• Add responsive breakpoints (mobile‑first). |
| **i18n** | Verify all keys exist for EN, FA, RU, ZH. Add missing keys for new UI strings (`action.freeInfoPrefix`, `action.freeInfoHighlight`, `action.freeInfoSuffix`). |
| **Backend Service** | • Add JWT authentication middleware (`authMiddleware`).  
• Harden `UsernameHandler` with structured logging (slog).  
• Add request‑id propagation. |
| **Database** | • Create migration `20260504_create_username_schema.sql` (PostgreSQL).  
• Tables: `users`, `username_reports`, `rate_limit`.  
• Index on `username_reports.username`. |
| **Caching** | Ensure cache keys have TTL (5 min for availability, 24 h for reports). |
| **Security** | • Rate‑limit already present – keep.  
• Validate username with regex (already).  
• Add `Content‑Security‑Policy` header in responses. |
| **Testing** | • Frontend: `ActionArea.test.tsx` using `@solidjs/testing-library` + Vitest.  
• Backend: `aggregator_test.go`, `username_handler_test.go` using `testing` & `testify`.  
• Aim for **≥ 85 %** coverage overall. |
| **Documentation** | • OpenAPI spec `openapi.yaml` for `/collection-stats` and `/username/check`.  
• README section with usage example and JWT secret generation. |
| **Lint / Type‑check** | Run `npm run lint && npx tsc --noEmit` after each change. |
| **CI / DevOps** | Add GitHub Actions workflow `ci.yml` that runs lint, type‑check, tests, and builds the app. |

## Execution Order (fastest feedback first)
1. **Database migration** – create SQL file.
2. **Backend auth middleware** – implement and wire into router.
3. **Frontend UI overhaul** – edit `ActionArea.tsx` & related CSS classes.
4. **i18n keys** – add missing translations.
5. **Tests** – write frontend and backend test suites.
6. **OpenAPI spec** – generate `openapi.yaml`.
7. **CI workflow** – add GitHub Actions file.
8. **Run full lint / type‑check**.
9. **Run all tests** and verify coverage.

## Acceptance Criteria
- All TypeScript files compile with **no errors**.
- `go test ./...` passes with **≥ 85 %** coverage.
- Lint returns **zero warnings**.
- UI complies with **frontend‑specialist design rules** (no glassmorphism, no purple, sharp corners, bold cyan/green/red palette, micro‑animations, full accessibility).
- OpenAPI spec accurately describes the two public endpoints.
- Migration runs cleanly on a fresh PostgreSQL instance.
- JWT middleware validates a token and returns **401** on failure.
- Documentation is up‑to‑date.

---
*If you approve, I will start applying the changes in the order defined above.*
