# 📘 iFragment — Channel Management System: Full-Stack AI Architecture Specification
> **Document Type:** AI Persistent Architecture Manual & Codebase Ground Truth  
> **Target Audience:** Autonomous AI Coding Agents & Engineers  
> **Last Synchronized:** 2026-09-05  
> **Workspace:** `iFragment` (Telegram Mini App — SolidJS + Go 1.25 + Postgres 17 + DragonflyDB)  
> **Rule for Future AI Agents:** Whenever you modify, debug, or add features to Channel Management (`internal/service/channelmgmt`, `internal/handler/webhook.go`, or `frontend/src/pages/channel/*`), **YOU MUST READ THIS FILE FIRST** and **UPDATE THIS SPECIFICATION** to keep documentation in 100% sync with active code.

---

## 1. Executive Overview & Problem Statement

The **Channel Management (مدیریت کانال)** module in iFragment is an enterprise-grade automation engine designed for Telegram channel administrators and content creators. It functions as a complete **Funnel & Content Pipeline (قیف و خط لوله پردازش محتوا)**, converting raw channel feeds into enriched, branded, and filtered broadcasts.

### Key Capabilities:
1. **Zero-Session Inbound Reading (بدون سشن / Telethon):** Ingestion of public source channels via `https://t.me/s/{channel_username}` without needing Userbot MTProto sessions or phone numbers.
2. **Automatic Transformation Pipeline:** Ad removal (`#ad`, `#spon`), link extraction, hashtag cleaning, AI rewrites, glass inline buttons, and automated signatures/watermarks.
3. **High-Resiliency Telegram Bot API (9.4 – 10.3 Compliance):** Automatic fallback from formatted HTML to raw plain text upon entity parsing errors (`can't parse entities`), avoiding dropped posts.
4. **Smart Join Request Approvals:** Uses `user_chat_id` (Telegram Bot API 9.4+) to message joining users without prior `/start` requirement. Evaluates multi-tier policies: Telegram Premium, Profile Photo presence, Account Age (anti-burner), Collectibles (Fragment usernames), and Telegram Gifts.
5. **Dynamic Bio & Title Engine:** Auto-updating bio/title with real-time stats (member counts, UTC clocks, crypto prices `$btc`, `$ton`, `$eth`, `$frg`, countdowns), strictly rate-limited and diff-checked to avoid Telegram `400 chat description is not modified` and `429 Too Many Requests`.
6. **Transparent Subscription & Trial UI:** Clear visibility of Stars (⭐ 250 Stars/mo), 72-hour free trials with live countdowns, and instant activation.

---

## 2. Full-Stack Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SolidJS + Vite)                       │
│  - ManagedChannelsPage.tsx (Projects Entrance Card & Quick Switcher)   │
│  - ProjectsPage.tsx (Project Pipeline Configuration & Status)          │
│  - ChannelPostingPage.tsx (AI Model Picker & Composer Settings)        │
│  - ChannelGeneralSettingsPage.tsx (Signatures, Watermarks, Join Rules) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Telegram WebApp SDK / REST API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Go 1.25 HTTP API)                      │
│                                                                        │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │ WebhookHandler        │          │ PublicChannelScraper (Cron)   │  │
│  │ (channel_post events) │          │ (t.me/s/{username} scraper)   │  │
│  └───────────┬───────────┘          └───────────────┬───────────────┘  │
│              │                                      │                  │
│              └──────────────────┬───────────────────┘                  │
│                                 ▼                                      │
│               ┌───────────────────────────────────┐                    │
│               │     ChannelService & Funnel       │                    │
│               │  - Album Buffering (DragonflyDB)  │                    │
│               │  - Filter Pipeline (Ads/Links)    │                    │
│               │  - Watermark & Signature Engine   │                    │
│               │  - AI Composer (Gemini 3.8 Flash) │                    │
│               └─────────────────┬─────────────────┘                    │
│                                 │                                      │
│                 ┌───────────────┴───────────────┐                      │
│                 ▼                               ▼                      │
│      [Auto-Publish Directly]        [Owner DM Review Panel]            │
│       Target Channel Output         Interactive Keyboard Preview       │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  STORAGE LAYER (PostgreSQL 17 + DragonflyDB)           │
│  - `projects` / `channel_funnels` / `managed_channels`                 │
│  - `channel_settings` (JSONB: general, posting, forwarding, bio, ...)  │
│  - `pending_funnel_posts` & `channel_audit_logs`                       │
│  - Redis Keys: `media_group:{id}`, `scraper:seen:{user}:{id}`          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Data Models

### 3.1 `projects` Table (Decoupled Funnel Model)
The primary orchestrator between an input (source) channel and an output (target) channel.
```sql
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'expired'
    stars_subscription_active BOOLEAN NOT NULL DEFAULT FALSE,
    stars_expires_at TIMESTAMPTZ,
    trial_used BOOLEAN NOT NULL DEFAULT FALSE,
    trial_ends_at TIMESTAMPTZ,
    source_channel_id UUID REFERENCES managed_channels(id) ON DELETE SET NULL,
    target_channel_id UUID REFERENCES managed_channels(id) ON DELETE SET NULL,
    source_chat_id BIGINT,
    target_chat_id BIGINT,
    pipeline_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `pipeline_config` JSON Structure:
```json
{
  "source_channel_identifier": "durov",
  "target_channel_identifier": "my_channel",
  "remove_ads": true,
  "remove_links": false,
  "remove_hashtags": false,
  "drop_media": false,
  "ai_rewrite": true,
  "watermark": "@MyChannel"
}
```

### 3.2 `channel_settings` Table
Centralized per-channel configurations partitioned into JSONB categories:
- `general`: Signatures (`signMessages`, `customSignature`), Join request rules (`joinRequestsEnabled`, `approvePremium`, `approveProfilePhoto`, `approveAccountAge`, `approveCollectibles`, `approveGifts`), autoForwarding.
- `posting`: Watermark text & toggle, AI Provider (`gemini`, `openai`, `anthropic`, `groq`), API keys, AI model (`gemini-3.8-flash`), `aiConfirmBeforeEdit` (controls direct auto-publish vs DM manual approval), skill persona (`selectedSkill`, `customSkillPrompt`).
- `forwarding`: Direct forwarding/mirroring rules between channels with content-type selectors.
- `inline_buttons`: Pre-configured glass buttons attached to broadcasts.
- `dynamic_bio`: Bio & title live templates with countdowns and crypto prices.
- `auto_responder`: Trigger rules and AI-generated first comment settings for discussion groups.

---

## 4. The 8 Core Modules Deep Dive

### 4.1 Module 1: Sessionless Channel Ingestion (`PublicChannelScraper`)
- **File:** `backend/internal/service/channelmgmt/public_channel_scraper.go`
- **Mechanism:** HTTP scraper pulling `https://t.me/s/{channel_username}`.
- **Why it matters:** Telegram bots **cannot** receive webhook updates from channels where they are not administrators. The scraper enables users to forward from any public channel without logging in with a user account (Telethon/Pyrogram).
- **Features:**
  - Extracts text, raw HTML, single photos, album media, video files, and post timestamps.
  - Redis deduplication (`scraper:seen:{channel}:{msgID}`) with 7-day TTL.
  - Periodic polling ticker (default: 45 seconds).
  - Automatically feeds extracted posts into `DispatchScrapedPost` to trigger active projects and forwarding rules.

### 4.2 Module 2: The Funnel & Processing Pipeline (`FunnelService`)
- **File:** `backend/internal/service/channelmgmt/funnel_service.go`
- **Album / Media Group Buffer:**
  - Telegram sends album photos as separate individual webhook events sharing a single `media_group_id`.
  - The engine uses a 2-second Redis sliding-window aggregation (`media_group:{id}:items`) with distributed locking (`lock:mg:{id}`). The leader goroutine waits for the window to settle, consolidates all media into a single album payload, and proceeds.
- **Transformation Pipeline:**
  1. Filter ads (`#ad`, `#spon`).
  2. Strip or retain hyperlinks (`removeLinksHelper`).
  3. Strip hashtags (`removeHashtagsHelper`).
  4. Generate AI variations if `aiComposerEnabled`.
  5. Apply Watermark (`posting.WatermarkText`) and Signature (`general.CustomSignature` or legacy `posting.Signature`).
  6. Attach Inline Glass Buttons from `channel_buttons`.
- **Auto-Publish vs Review:**
  - If `!posting.AiConfirmBeforeEdit`: Post is automatically and immediately published to the target channel via `publishFunnelPostDirectly`.
  - If `posting.AiConfirmBeforeEdit`: A live preview message is dispatched to the bot owner's Telegram DM with an interactive control panel keyboard (`Publish Now`, `Style Variations`, `Reject`).
- **Resilient Formatting:**
  - All messages default to `HTML` parsing with fallback to plain text if Telegram returns `can't parse entities` or `Bad Request`.

### 4.3 Module 3: AI Post Composer & LLM Engine (`llm.go`)
- **File:** `backend/internal/service/channelmgmt/llm.go`
- **Supported Providers:**
  - **Google Gemini:** Default model `gemini-3.8-flash` (with fallback to `gemini-2.5-flash`). Auth style: `Bearer {AIza...}`.
  - **OpenAI:** `gpt-4o-mini`.
  - **Anthropic:** `claude-3-5-haiku-latest`. Auth style: `x-api-key`.
  - **Groq:** `llama-3.3-70b-versatile`.
  - **xAI:** `grok-3-mini`.
  - **Moonshot Kimi:** `kimi-k2-turbo-preview`.
  - **DeepSeek:** `deepseek-chat`.
- **Custom Skill Personas:** Supports journalist, marketer, casual/humorous, crypto analyst, or custom user-defined system prompts.

### 4.4 Module 4: Telegram Join Request Engine (Bot API 9.4–10.3)
- **File:** `backend/internal/handler/webhook.go` (`handleChatJoinRequest`)
- **Key API Rule:**
  - When users submit a join request, they have **not** necessarily started the bot. Messaging `req.From.ID` fails with `403 Forbidden: bot can't initiate conversation with a user`.
  - **Fix:** Telegram Bot API 9.4+ provides `req.UserChatID`. The handler targets `req.UserChatID` (fallback to `req.From.ID`) for verification prompts and rejection notices.
- **Policy Enforcement:**
  1. `ApprovePremium`: Rejects non-premium users.
  2. `ApproveProfilePhoto`: Rejects accounts without a profile avatar.
  3. `ApproveAccountAge`: Flags fresh burner accounts (Telegram sequential user ID > 7.8 billion).
  4. `ApproveCollectibles`: Requires a collectible username without underscores.
  5. `ApproveGifts`: Requires active gifts or premium status in iFragment ecosystem.
- **Audit Trails:** Approved and declined requests are persistently recorded in `channel_audit_logs`.

### 4.5 Module 5: Dynamic Bio & Title Worker
- **File:** `backend/internal/service/channelmgmt/channel_dynamic_bio_worker.go`
- **Execution:** Runs in background every 5 minutes with a Redis distributed lock (`lock:dynamic_bio_worker`).
- **Template Variables:**
  - `$members`: Real-time chat member count.
  - `$time`: UTC clock (`HH:mm`).
  - `$date`: Formatted date (`DD MMM YYYY`).
  - `$day_name`: Current weekday name.
  - `$countdown`: Days remaining until target event date.
  - `$btc`, `$ton`, `$eth`, `$frg`: Live crypto prices from `CryptoPriceService`.
- **Telegram Limits & Diff-Checking:**
  - Bio length is clamped to **255 characters**.
  - Title length is clamped to **128 characters**.
  - **Diff Guard:** Compares rendered string against `s.lastBioContent` and `s.lastTitleContent`. Telegram API is **only called if the content has changed**, completely eliminating `400 Bad Request: chat description is not modified` and `429 Too Many Requests`.

### 4.6 Module 6: Auto-Responder & First Comment
- **File:** `backend/internal/service/channelmgmt/auto_responder_service.go`
- **Matching Modes:** `exact`, `contains`, `regex`, `keyword`, and `ai`.
- **Rate-Limiting:** Cached in Redis as `auto_responder_rl:{chat_id}` with sliding window to prevent bot spam loops.
- **First Comment Generation:** Can generate context-aware comments or TL;DR summaries automatically when a channel post links to a discussion group.

### 4.7 Module 7: Glass Inline Buttons System
- **File:** `backend/internal/service/channelmgmt/button_service.go`
- **Button Types:**
  - `url`: Direct external link.
  - `webapp`: Mini App URL launch (`web_app: { url }`).
  - `copy`: Copies specified payload to user's clipboard (`copy_text: { text }`).
  - `callback`: Triggers bot webhook callback event.
  - `share`: Telegram native forward/share dialog (`switch_inline_query`).

### 4.8 Module 8: Subscriptions, Trials & Project Entrance Cards
- **Files:**
  - `frontend/src/pages/channel/managed-channels/ui/ManagedChannelsPage.tsx`
  - `frontend/src/pages/channel/projects/ui/ProjectsPage.tsx`
- **Model:**
  - **Stars Plan:** 250 ⭐ Telegram Stars / month.
  - **Free Trial:** 72 hours automatically granted upon project creation.
  - **Status States:**
    - `ACTIVE`: Paid subscription active with expiration date.
    - `TRIAL`: 72-hour trial active with countdown timer.
    - `PAUSED`: Pipeline temporarily paused by user.
    - `EXPIRED`: Trial or subscription ended; requires renewal.

---

## 5. Verification & Testing Standards

### 5.1 Backend Verification
Run unit tests for channel management:
```bash
cd backend
go test -v ./internal/service/channelmgmt/...
go build ./...
```

### 5.2 Frontend Verification
Run frontend build to verify SolidJS bundle and TypeScript types:
```bash
cd frontend
npm run build
```

---

## 6. Guidelines for Future AI Agents Updating Channel Management

1. **Always Check Bot API Constraints:** Telegram changes rate limits and schemas. Check official Bot API documentation before altering message editing or channel modification calls.
2. **Never Revert to Raw Markdown:** Telegram markdown parser is brittle against user-generated channel text. Always use `HTML` with `telegram.EscapeHTML(...)` and the entity parse-error fallback.
3. **Keep Projects and Funnels Synchronized:** When querying funnels for an input chat ID, always query both `channel_funnels` and `projects` tables.
4. **Idempotency is Mandatory:** All database migrations must use `IF NOT EXISTS` and check constraints.
5. **Update This Specification:** When you modify any file in `internal/service/channelmgmt`, update the corresponding section in this document.
