# 🏛️ MASTER PROMPT — iFragment Unified Paywall & Credit Economy Redesign

> این فایل یک پرامپت آماده‌ی تحویل به AI Builder است. عیناً کپی و اجرا شود.
> Copy-paste everything below this line to the builder agent.

---

## ROLE

You are a senior product engineer working inside the **iFragment** Telegram Mini App repository (SolidJS + Vite + TailwindCSS frontend, Go backend). You will rebuild the entire **paywall + credit economy experience** across all three intelligence verticals — Usernames (`@handle`), Anonymous Numbers (`+888 XX XXXXXX`), and Telegram Gifts — into ONE unified, honest, visually stunning system. This is the revenue surface of the app; craft it like a luxury fintech checkout, not a generic paywall.

## NON-NEGOTIABLE RULES (violating any of these = failed task)

1. **ZERO fabricated data.** Never render a number that did not come from an API response or a deterministic client-side computation on real user input. No hardcoded counters, no `|| 23`, no fake fallbacks like `'Plush Pepe' #42`. If data is missing → show an explicit empty/disabled state.
2. **The paywall section contains ONLY payment.** Delete every "N signals collected / N risks identified / N sources" curiosity chip from all three report pages ([`NumberReportPage.tsx`](../frontend/src/pages/numbers/report/ui/NumberReportPage.tsx), [`GiftReportPage.tsx`](../frontend/src/pages/gifts/report/ui/GiftReportPage.tsx), [`username/ui/index.tsx`](../frontend/src/pages/username/ui/index.tsx)). Curiosity moves INTO the search experience (component A below).
3. **Airdrop coins NEVER unlock a report directly.** The only path to a report is: spend 1 Intel Credit. Coins are converted INTO credits at a deliberately hard grind rate. Remove all direct coin-unlock buttons and their backend calls (`UnlockWithCoins` usage from UI; keep endpoint but stop calling it).
4. **One currency gate:** every premium action costs Intel Credits. Credits are purchased with ⭐ Telegram Stars (primary), 🪙 Airdrop Coins (exchange, expensive), or 💎 TON (secondary).
5. **Balance transparency:** the user must ALWAYS see their live credit balance (`GET /intel/credits`) near every pay action, with expiry hint when relevant.
6. **Consistency:** one shared component family for all three verticals. Only accent theming differs per vertical (Username = amber ✦, Number = TON blue #0098EA, Gift = purple #AF52DE).
7. Respect existing conventions: haptics via `shared/lib/haptic.js`, i18n via `t()` with fa/en/ru/zh keys, RTL-first layout (`rtl:` variants), back-button hook, max-width 480px dark canvas `#06070B`.

## DESIGN SYSTEM (use exactly)

- Canvas `#06070B`; card surface `#12141C`/80 with `backdrop-blur-xl`; borders `white/[0.08]`; radii: cards `rounded-[28px]`, chips `rounded-full`, buttons `rounded-2xl`.
- Accents: TON blue `#0098EA`, purple `#AF52DE`, success emerald `#34C759`/`#10b981`, warning amber `#FFB800`, danger rose.
- Typography: numbers/prices always `font-mono font-black tracking-tight`; labels `text-[10px] uppercase tracking-widest text-white/40`.
- Motion: entrance `translate-y-2 opacity-0 → 0/1` 300ms ease-out staggered 60ms per element; price reveal uses a count-up animation; purchase success plays a radial glow burst + `haptic.notify('success')`. All motion ≤ 400ms, respect `prefers-reduced-motion`.
- Depth: subtle ambient gradient glows behind hero areas only (already used app-wide) — never behind forms.

## COMPONENTS TO BUILD

### A) `SearchTeaser` — mystery INSIDE the search box (replaces deleted curiosity chips)
While the user types (debounce 350ms), render 1–3 cryptic, REAL, deterministic teaser chips under the input, derived only from cheap local analysis of the raw query — never from paid data:
- Number input: detect tail pattern / palindrome / digit run locally (port logic shape from `features.go` conceptually): e.g. fa: «🔒 الگوی تکراری در ارقام پایانی شناسایی شد»، «🔒 تقارن ریاضی کامل»، «🔒 ترکیب ارقام نامتعارف». 
- Username input: length tier + charset class: «🔒 نام کوتاهِ کم‌یاب»، «🔒 دامنه‌ی Premium»، «🔒 شامل کلمه‌ی کلیدی باارزش».
- Gift input: resolved model family: «🔒 مدل شناسایی‌شده: Plush Pepe»، «🔒 سریال تک‌رقمی».
Chips style: `bg-white/[0.04] border-white/10 rounded-full px-3 py-1.5 text-[11px] font-bold` with a small lock glyph; shimmer-sweep animation once. Chips NEVER show prices, percentiles, or counts. If nothing notable → show single neutral chip «🔒 سیگنال‌های مخفی برای باز کردن وجود دارد».

### B) `UnifiedPaywallGate` — the ONLY paywall block (used by all 3 report pages)
Vertical stack, strictly payment-focused:
1. **Price line**: «گزارش کامل این {نوع}» + big mono «1» + credit glyph + subtle «≈ $X» anchor (from config API, not hardcoded).
2. **CreditWalletBar** (component C) inline showing balance.
3. Primary CTA: «باز کردن با ۱ کریدت» — gradient blue→purple, full width, haptic medium. Disabled state if balance < 1 with helper text «کریدت نداری؟ زیر خرید کن ↓».
4. Secondary link-style row: «دریافت کریدت» → opens `CreditStoreSheet` (component D). This is the ONLY other action. No sponsor-task button, no direct coins button, no free-unlock button inside the gate.
5. Micro-trust footer: «نتیجه فوری · گزارش برای ۲۴ ساعت قفل نمی‌شود · نمونه گزارش» where «نمونه گزارش» opens a static sample modal built from REAL anonymized structure (no invented numbers — use blurred placeholders).

### C) `CreditWalletBar`
Persistent slim bar (also embeddable in profile & gate): left: credit glyph + mono balance animated count-up; middle: expiry pill if `next_expiry` within 14 days («۳ کریدت تا ۱۲ روز دیگر منقضی می‌شود»); right: «+» button → store sheet. Pull-to-refresh revalidates.

### D) `CreditStoreSheet` — bottom sheet, the heart of the economy
Two tabs:
**Tab 1 — Buy with ⭐ Stars** (primary, visually dominant):
- Pack cards: `1 credit = 100★`, `3+1 bonus = 250★` (badge «پرطرفدار»), `10+3 = 800★` (badge «بهترین ارزش»). Each card: gradient border on hover/active, Stars glyph, mono price, bonus badge, CTA «خرید». Payment flows through the EXISTING Stars order/payload/polling flow already implemented in the username vertical — generalize it.
**Tab 2 — Exchange & more**:
- 🪙 Coins exchange card: «۵۰,۰۰۰ سکه → ۱ کریدت» with progress ring showing user's current coins toward next credit + copy: «سکه‌ها با فعالیت روزانه جمع می‌شوند؛ تبدیل آن‌ها سخت است — کریدت مستقیم بخر تا سریع‌تر باشی». Rate constant comes from backend config, never hardcoded.
- 💎 TON card: «۱ کریدت ≈ X TON» via existing order flow.
- Utility card (education, not purchase): «۳ کریدت = ۱ ماه اشتراک مدیریت گروه/کانال» with deep-link to management plans.
Sheet has drag-handle, backdrop blur, closes on swipe-down, focus-trapped.

### E) Post-purchase celebration
On successful unlock: confetti-free radial glow burst on the card + count-up of the revealed value + `haptic.notify('success')` + toast «۱ کریدت مصرف شد · موجودی: N». Balance everywhere updates optimistically then reconciles with API.

## CREDIT ECONOMY (backend work required)

- New config service values (env-backed, documented in `.env.example`): `CREDITS_PER_REPORT=1`, `COINS_PER_CREDIT=50000`, `STARS_PRICE_CREDIT_1=100`, `STARS_PACK_3_1=250`, `STARS_PACK_10_3=800`.
- New endpoints:
  - `POST /intel/credits/purchase` `{method: "stars"|"ton", pack: "c1"|"c3p1"|"c10p3"}` → returns order payload (reuse username Stars order machinery).
  - `POST /intel/credits/exchange-coins` `{}` → atomically deducts `COINS_PER_CREDIT` coins, grants 1 credit (single DB transaction, FIFO ledger entries both sides).
  - `GET /intel/credits/config` → public rates for UI (so FE never hardcodes prices).
- Extend credit spend reasons: `report:number`, `report:gift`, `report:username`, `plan:management_monthly` (3 credits).
- All money-touching paths idempotent (reuse `idem_key` pattern).

## I18N COPY (add these exact keys; fa is source of truth, translate faithfully)

| key | fa | en |
|---|---|---|
| `paywall.title.number` | گزارش کامل این شماره | Full report for this number |
| `paywall.title.username` | گزارش کامل این نام کاربری | Full report for this username |
| `paywall.title.gift` | گزارش کامل این گیفت | Full report for this gift |
| `paywall.cta.unlock` | باز کردن با ۱ کریدت | Unlock with 1 credit |
| `paywall.no_credits` | کریدت کافی نداری | Not enough credits |
| `paywall.get_credits` | دریافت کریدت | Get credits |
| `paywall.trust` | نتیجه فوری · بدون اشتراک اجباری | Instant result · no forced subscription |
| `wallet.balance` | کریدت شما | Your credits |
| `wallet.expires_soon` | {count} کریدت تا {days} روز دیگر منقضی می‌شود | {count} credits expire in {days} days |
| `store.stars_tab` | خرید با ستاره | Buy with Stars |
| `store.exchange_tab` | تبدیل و سایر روش‌ها | Exchange & more |
| `store.coins_exchange` | {amount} سکه ایردراپ → ۱ کریدت | {amount} Airdrop coins → 1 credit |
| `store.coins_grind_note` | سکه با فعالیت روزانه جمع می‌شود و تبدیلش عمداً سخت است؛ راه سریع‌تر خرید مستقیم است. | Coins come from daily activity and conversion is intentionally hard; buying directly is faster. |
| `store.plan_utility` | ۳ کریدت = ۱ ماه مدیریت گروه/کانال | 3 credits = 1 month group/channel management |
| `teaser.locked_generic` | 🔒 سیگنال‌های مخفی برای باز کردن وجود دارد | 🔒 Hidden signals await unlock |
| `toast.credit_spent` | ۱ کریدت مصرف شد · موجودی: {balance} | 1 credit spent · balance: {balance} |

Remove/deprecate keys: `numbers.freeUnlockTask`, `numbers.freeZeroTon`, `valuation.signals_collected`, `valuation.risks_identified`, `valuation.sources_aggregated` usages.

## STATES & EDGE CASES (implement all)

Loading skeletons (shimmer, same geometry) for wallet bar & store packs · insufficient balance (CTA disabled + inline upsell) · purchase pending (button → spinner + «در انتظار تأیید…», poll like username flow) · failure (rose banner + retry, credits untouched) · network offline (cached balance with stale badge) · concurrent tab (revalidate on visibilitychange) · RTL mirroring verified · ru/zh translations included.

## ACCEPTANCE CHECKLIST

- [ ] Zero occurrence of hardcoded signal/risk/source counters in repo (`grep` proves it).
- [ ] No UI path unlocks any report with coins directly.
- [ ] All three report pages import the SAME `UnifiedPaywallGate`, differing only by theme prop.
- [ ] Balance visible on every screen containing a pay action.
- [ ] Store rates rendered exclusively from `/intel/credits/config`.
- [ ] SearchTeaser shows only locally-computable, non-price-leaking hints.
- [ ] `go test ./...` green; new handlers covered by table tests (exchange idempotency, insufficient funds).
- [ ] Frontend lint/format clean; e2e smoke: search → teaser → gate → buy pack (mocked payments) → unlock → watchlist allowed.

## FORBIDDEN ANTI-PATTERNS

Fake urgency timers · dark-pattern confirm shaming · invented statistics · multi-column desktop layouts · light theme · emoji as primary icons (Material Symbols only) · alert()/confirm() · prices in component code · new CSS files (Tailwind utilities only) · breaking existing routes/APIs.
