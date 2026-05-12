# 🚀 iFragment Optimization & Hardening Plan (v1)

This plan aims to elevate the iFragment project from its current 58/100 score to a production-ready 100/100 by addressing all critical bugs, stability issues, and UX gaps identified in the audit report.

## 📋 Success Criteria
- [ ] 0 Critical (🔴) or Serious (🟠) issues remaining.
- [ ] Analytics perfectly synchronized with bot events.
- [ ] Onboarding flow provides a premium first-impression.
- [ ] Performance bottleneck (`GetChatMember`) resolved via Redis caching.
- [ ] Frontend compile errors resolved.

## 🛠 Tech Stack
- **Backend**: Go 1.22+, `pgx` (PostgreSQL), `redis` (Caching), `chi` (Routing).
- **Frontend**: SolidJS, TMA SDK (Telegram Mini Apps), Motion (Animations).
- **Infrastructure**: Redis for idempotency and caching.

---

## 📅 Task Breakdown

### Phase 1: Critical Fixes (🔴) - [High Priority]

| Task ID | Name | Agent | Skills | Priority | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `P1-F1` | Fix `MandatoryPage.tsx` Compile Error | `frontend-specialist` | `lint-and-validate` | 🔴 Critical | None |
| `P1-B1` | Fix Analytics `event_type` Mismatch | `backend-specialist` | `database-design` | 🔴 Critical | None |
| `P1-B2` | Implement `spam_blocked` Event Logging | `backend-specialist` | `clean-code` | 🔴 Critical | None |
| `P1-B3` | Correct Admin Bypass Logic in Moderator | `backend-specialist` | `clean-code` | 🔴 Critical | None |

### Phase 2: Stability & Logic (🟠) - [Medium Priority]

| Task ID | Name | Agent | Skills | Priority | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `P2-B1` | Implement `GetChatMember` Redis Cache | `backend-specialist` | `performance-profiling` | 🟠 Serious | None |
| `P2-B2` | Fix Idempotency Logic Order in Webhook | `backend-specialist` | `api-patterns` | 🟠 Serious | None |
| `P2-B3` | Add `parse_mode` to Telegram API Client | `backend-specialist` | `api-patterns` | 🟠 Serious | None |
| `P2-B4` | Replace `time.Sleep` with Goroutines in Webhook | `backend-specialist` | `clean-code` | 🟠 Serious | None |

### Phase 3: Premium Onboarding & UX (🟡) - [Polish]

| Task ID | Name | Agent | Skills | Priority | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `P3-B1` | Implement Premium Onboarding (3-Message Flow) | `backend-specialist` | `clean-code` | 🟡 Medium | `P2-B3` |
| `P3-B2` | Implement Auto-Delete (2 min) for Onboarding | `backend-specialist` | `clean-code` | 🟡 Medium | `P3-B1` |
| `P3-F1` | Replace `alert()` with Custom Toasts | `frontend-specialist` | `frontend-design` | 🟡 Medium | None |
| `P3-B3` | Implement Subscription Expiry Notifications | `backend-specialist` | `clean-code` | 🟡 Medium | None |

### Phase 4: Final Polish & Verification (🟢)

| Task ID | Name | Agent | Skills | Priority | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `P4-V1` | Run `security_scan.py` & `ux_audit.py` | `qa-automation-engineer` | `vulnerability-scanner` | 🟢 Low | All |
| `P4-V2` | Final Build & Performance Audit | `qa-automation-engineer` | `performance-profiling` | 🟢 Low | All |

---

## 📐 Implementation Details

### `P1-F1`: `MandatoryPage.tsx`
- **Input**: `frontend/src/pages/MandatoryPage/MandatoryPage.tsx`
- **Output**: Fixed imports and standardized state management.
- **Verify**: `npm run build` succeeds in `frontend` directory.

### `P1-B1`: Analytics Mismatch
- **Input**: `backend/internal/repository/analytics_repo.go` and `webhook.go`
- **Output**: Unified event names (`member_join`, `member_leave`, `spam_blocked`).
- **Verify**: Dashboard shows non-zero counts after events.

### `P2-B1`: Redis Caching
- **Input**: `backend/internal/service/botmgmt/moderator_service.go`
- **Output**: `GetChatMember` result cached in Redis (TTL: 5m) keyed by `group_id:user_id`.
- **Verify**: Reduced latency in message processing.

---

## ✅ PHASE X: VERIFICATION CHECKLIST
- [ ] All 🔴 issues fixed and verified.
- [ ] All 🟠 issues fixed and verified.
- [ ] Build passes for both Frontend and Backend.
- [ ] No hardcoded secrets.
- [ ] Markdown renders correctly in Telegram (parse_mode).
