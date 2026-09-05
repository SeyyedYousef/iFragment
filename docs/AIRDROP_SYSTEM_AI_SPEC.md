# iFragment Airdrop System — AI Technical Specification & Living Architecture

> **Document Type:** Living Architectural Specification (AI Master Ground Truth)  
> **System:** Telegram Mini App Gamification & Airdrop Ecosystem  
> **Last Verified & Synchronized:** 2026-09-05  
> **Maintainer Instruction for Future AI Agents:** Whenever modifying any aspect of the Airdrop system (energy rates, fatigue tiers, offline mining formulas, reward batches, clan scoring, or frontend animations), YOU MUST UPDATE THIS SPECIFICATION FIRST.

---

## 1. Executive Summary & Philosophy

The **iFragment Airdrop System** is a Telegram-native Game-Fi and engagement vertical designed to reward active users of the iFragment platform (a marketplace and valuation tool for Telegram usernames, gifts, and anonymous numbers).

### Historical Evolution & Deprecations:
- **FRG Token & Marketplace Deprecation:** The platform previously had a legacy token called "FRG" and a `/marketplace` route. As of 2026, **FRG and the old marketplace have been completely deprecated** (endpoints return HTTP 410 Gone).
- **Canonical Currency:** The sole gamified currency is **Airdrop Coins** (stored in `user_stats.airdrop_coins`). In legacy code and JSON schemas, fields named `frg_reward` or `price_frg` now strictly represent Airdrop Coins for backward compatibility.
- **Intel Credits:** A high-tier utility currency (1 Intel Credit = 50,000 Airdrop Coins or purchaseable with Telegram Stars) used to unlock deep valuation reports.

---

## 2. High-Level Architecture & Component Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Telegram Client (iOS / Android / Desktop)            │
│                     Telegram WebApp JavaScript SDK                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Frontend Client (SolidJS + Vite)                      │
│  - Reactive Signals & Stores: entities/airdrop/model/store.ts           │
│  - UI Views: TapView, TasksView, ShopView, ClanView, FrensView         │
│  - Visual Physics: Canvas 2D Tap Particles & CoinBurstCelebration      │
│  - Animated Odometer: AnimatedCounter with easeOutExpo & Haptic        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API (JSON) + HMAC Signatures
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Reverse Proxy & Load Balancer (Caddy)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Backend Service (Go 1.25 Chi)                      │
│  - ProfileHandler & GamificationHandler & ClanHandler                  │
│  - ProfileService & GamificationService & ClanService                  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        DragonflyDB / Redis           │  │      PostgreSQL 17 DB        │
│ - Rate limits & nonces (SETNX)       │  │ - user_stats                 │
│ - Tap Batching: profile:taps:batch   │  │ - user_boosts                │
│ - Leaderboards: ZSET leaderboard:*   │  │ - user_credit_batches (FIFO) │
│ - 5-min cache for chat members       │  │ - user_tasks & quests        │
│ - Stats cache: profile:stats:{id}    │  │ - clans & clan_members       │
└──────────────────────────────────────┘  │ - user_ledger_events         │
                                          └──────────────────────────────┘
```

---

## 3. Core Game Loops & Mathematical Formulas

### 3.1. Tap-to-Earn & Energy System

- **Base Energy:** 500 points (refills at 1 energy/sec).
- **Multi-Tap Booster:** Increases coins per tap by +1 per level. (Max Level: 10, Price: `Level * 3000 Coins`).
- **Energy Limit Booster:** Increases max energy by +250 per level: `maxEnergy = 500 + (level - 1) * 250`. (Max Level: 10, Price: `Level * 2500 Coins`).
- **Turbo Boost (Daily Free):**
  - Allowed: 2 times per UTC calendar day.
  - Duration: Exactly 15 seconds (`INTERVAL '15 seconds'`).
  - Effect: **5x multiplier**, consumes **0 energy**.
- **Full Energy Boost (Daily Free):**
  - Allowed: 3 times per UTC calendar day.
  - Effect: Instantly refills energy to `maxEnergy`.
- **Telegram Premium Multiplier:**
  - Active Telegram Premium users receive a server-authoritative **2.0x multiplier** on all tap earnings.

### 3.2. Anti-Grind Fatigue Algorithm (Tiered Multiplier)

To deter automation and bots while rewarding humans, tap earnings scale down progressively based on total coins tapped within the current UTC day (`user_daily_boosts.tapped_coins`):

| Daily Tapped Coins | Fatigue Multiplier | Effective Rate | Remaining Tier Capacity |
|---|---|---|---|
| **0 – 5,000** | **1.00x** (100%) | Full Power | `5000 - dailyTapped` |
| **5,001 – 15,000** | **0.50x** (50%) | Half Power | `15000 - dailyTapped` |
| **15,001 – 30,000** | **0.25x** (25%) | Low Power | `30000 - dailyTapped` |
| **> 30,000** | **0.10x** (10%) | Minimum Fatigue Floor | `0` |

*Note: Resets automatically at 00:00:00 UTC.*

### 3.3. Offline Mining Bot (Tap-Bot)

- **Unlock Cost:** 50,000 Airdrop Coins (Single level).
- **Session Cap:** `(maxEnergy * multitapLevel * 1.5) + 2000.0`. Default max duration: 12 hours (43,200s).
- **Daily Cap:** `sessionCap * 3`.
- **Base Rate:** `(multitapLevel * 0.35 + energyLevel * 0.15 + 0.20) * level`.
- **Tiered Diminishing Returns Formula:**
  - First 50% of session cap: 100% base rate.
  - 50% to 75% of session cap: 50% base rate.
  - 75% to 100% of session cap: 25% base rate.
- **Proactive Telegram Push Notification:** Background worker checks full bots and sends an interactive Telegram message in user language (FA, RU, EN) with a Mini App direct-launch button.

### 3.4. 7-Day Daily Check-in Streak

- Users must claim once every calendar day (UTC).
- If a day is missed, streak resets to 1.
- **Reward Scale:**
  - Day 1: +500 Coins, 10 XP
  - Day 2: +1,000 Coins, 20 XP
  - Day 3: +2,500 Coins, 50 XP
  - Day 4: +5,000 Coins, 100 XP
  - Day 5: +10,000 Coins, 200 XP
  - Day 6: +25,000 Coins, 300 XP
  - Day 7: +50,000 Coins, 500 XP

### 3.5. Daily Secret Word Combo

- Configured in table `daily_combos`.
- Verified case-insensitively with trimmed input.
- Awards Airdrop Coins + XP and logs to `user_ledger_events` & `user_credit_batches`.

---

## 4. Financial Integrity: The Credit Batches & FIFO Ledger

Airdrop coins are subject to expiration and FIFO usage to prevent stale token inflation:

1. **`user_credit_batches` Table:**
   - Every earned coin amount (from taps, tasks, daily streak, offline mining, referrals, combos) **MUST** be recorded as an unexpired batch with source, earned timestamp, and expiry timestamp (15 to 30 days).
   - If a source increments `user_stats.airdrop_coins` without inserting a batch, the coins will be deleted during the next cache miss or FIFO deduction!
2. **`DeductCreditsFIFO`:**
   - Deducts coins from the oldest active batch first.
   - Updates `user_stats.airdrop_coins = SUM(remaining_amount) FROM user_credit_batches`.
3. **`MaintainUserStats` Worker:**
   - Marks batches past `expires_at` as expired.
   - Reconciles `user_stats.airdrop_coins` against active batches.
4. **Coin Decay Worker:**
   - Users inactive for > 5 days suffer a 2% daily coin decay penalty.

---

## 5. Clans (Squads) & Leaderboards

- **Clan Concept:** Every public Telegram channel can be a Squad/Clan in iFragment.
- **Join Verification:** Verified via Bot API (`GetChatMember`) or MTProto userbot. Users must be active subscribers of the Telegram channel.
- **Score Calculation:** Clan score aggregates active members' XP (`SUM(us.xp)` over 1 day or 7 days) and total members count.
- **Redis Leaderboard:** Cached in sorted set `leaderboard:daily:{date}` and `leaderboard:weekly:{year-Wweek}` with 5-minute background refresh.

---

## 6. Anti-Cheat & Security Hardening

1. **Replay Attack Prevention:** Every tap request sends a unique client-generated `nonce`. Server checks and stores `tap:nonce:{userID}:{nonce}` in Redis via `SETNX` with a 5-minute TTL. Duplicate nonces immediately fail with HTTP 400.
2. **Timestamp Freshness:** Client sends `client_ts`. Clamped to a strict ±30 second drift window against server UTC time.
3. **Request Tap Clamping:** Maximum 500 taps per network request.
4. **Telegram HMAC Verification:** Client signs `{nonce}:{count}:{ts}` with WebApp `initData`.
5. **Cooldown on Clan Hopping:** Redis enforces a 10-minute cooldown on switching squads to prevent leaderboard manipulation.

---

## 7. Game-Fi UX: Visual Celebrations & Rolling Counter

To ensure maximum player feedback (satisfying "Game Feel"):
1. **CoinCelebration Particle Engine (`CoinCelebration.tsx`):**
   - Emitters generate 14-18 shiny 3D gold coin sprites from the interaction origin.
   - Follows quadratic bezier trajectory curves towards the top balance indicator with random jitter and scale transitions.
   - Coordinates synchronized with Telegram Haptic Feedback (`haptic.impact('medium')` and `haptic.notify('success')`).
2. **AnimatedCounter Component (`AnimatedCounter.tsx`):**
   - Smoothly tweens balance numbers from `startValue` to `endValue` over ~1200ms using `easeOutExpo`.
   - Triggers an elastic scale punch (`scale(1.15)`) and golden halo pulse on the balance badge on each coin arrival.
3. **Integration Points:**
   - Bot Offline Mining Collect.
   - Daily Streak Calendar Claim.
   - Tasks / Quests Complete & Claim.
   - Daily Secret Combo Word Bonus.
