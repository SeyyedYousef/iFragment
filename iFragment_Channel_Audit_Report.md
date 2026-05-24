# 📊 گزارش جامع ممیزی پروژه iFragment - ماژول مدیریت کانال

> **تاریخ گزارش:** ۲۰۲۶/۰۵/۲۳
> **منبع:** https://github.com/SeyyedYousef/iFragment
> **آخرین کامیت بررسی‌شده:** `75ba6e3` — Logger + OpenTelemetry + Rate Limiter Hardening
> **محدوده:** ماژول کانال (Frontend + Backend + DB + Telegram Integration)

---

## 🎯 خلاصه مدیریتی (TL;DR)

> ## **نمره فعلی: ۲۷ / ۱۰۰**

پروژه iFragment یک تکنولوژی استک عالی و معماری تمیز دارد (Go + SolidJS + PostgreSQL + DragonflyDB). ولی **ماژول کانال** در وضعیت فعلی، یک **ساختمان بدون پی** است:

- ✅ **فرانت‌اند کانال:** ۱۲ صفحه UI کامل با حدود ۴۰۰۰ خط TSX (دکوراتیو، Mock-data، localStorage)
- ❌ **بک‌اند کانال:** **صفر خط کد اختصاصی کانال**. کل بک‌اند فقط برای `group`/`supergroup` نوشته شده است.
- ❌ **APIای به اسم `channel-management`** که فرانت فراخوانی می‌کند، **در بک‌اند موجود نیست**.
- ❌ هیچ هندلر `channel_post` یا `edited_channel_post` در `webhook.go` وجود ندارد.
- ⚠️ ۸ باگ امنیتی و ۱۲ باگ منطقی در بخش بک‌اند موجود (که برای گروه نوشته شده) شناسایی شد.

**به زبان ساده:** ۷۵٪ از فرانت‌اند کانال به APIای متصل شده که هنوز ساخته نشده. این یک "Vaporware Layer" است که باید پر شود.

---

## 📑 فهرست مطالب

1. [نقشه وضعیت فعلی](#۱-نقشه-وضعیت-فعلی)
2. [تحلیل دقیق فرانت‌اند](#۲-تحلیل-دقیق-فرانتاند)
3. [تحلیل دقیق بک‌اند](#۳-تحلیل-دقیق-بکاند)
4. [تحلیل دیتابیس](#۴-تحلیل-دیتابیس)
5. [یافته‌های بحرانی امنیتی](#۵-یافتههای-بحرانی-امنیتی)
6. [یافته‌های منطقی و باگ‌ها](#۶-یافتههای-منطقی-و-باگها)
7. [مسائل عملکرد و مقیاس‌پذیری](#۷-مسائل-عملکرد-و-مقیاسپذیری)
8. [انطباق با Telegram API](#۸-انطباق-با-telegram-api)
9. [نقشه راه ۰ تا ۱۰۰](#۹-نقشه-راه-۰-تا-۱۰۰)
10. [چک‌لیست رفتن به Production](#۱۰-چکلیست-رفتن-به-production)

---

# ۱. نقشه وضعیت فعلی

## ۱.۱ نمره‌دهی تفکیکی (Detailed Scoring)

| بخش | نمره فعلی | حداکثر | درصد | وضعیت |
|------|-----------|--------|-------|--------|
| **معماری کلی پروژه** | ۸ | ۱۰ | ۸۰٪ | 🟢 خوب |
| **انتخاب تکنولوژی استک** | ۹ | ۱۰ | ۹۰٪ | 🟢 عالی |
| **فرانت‌اند UI کانال** | ۷ | ۱۰ | ۷۰٪ | 🟡 قابل قبول |
| **اتصال فرانت به بک‌اند کانال** | ۱ | ۱۰ | ۱۰٪ | 🔴 بحرانی |
| **بک‌اند منطق کانال** | ۰ | ۱۵ | ۰٪ | 🔴 وجود ندارد |
| **مدل دیتابیس کانال** | ۲ | ۱۰ | ۲۰٪ | 🔴 ناقص |
| **انطباق با Telegram API کانال** | ۱ | ۱۰ | ۱۰٪ | 🔴 بحرانی |
| **امنیت (کانال‌محور)** | ۳ | ۱۰ | ۳۰٪ | 🟠 ضعیف |
| **تست‌پذیری و CI/CD** | ۱ | ۵ | ۲۰٪ | 🟠 ضعیف |
| **مستندسازی API** | ۰ | ۵ | ۰٪ | 🔴 وجود ندارد |
| **i18n و UX کانال** | ۶ | ۵ | بیش از ۱۰۰٪ | 🟢 عالی |
| **مجموع** | **۲۷** | **۱۰۰** | **۲۷٪** | 🔴 **پری‌آلفا** |

## ۱.۲ نقشه فایل‌ها

```
✅ FRONTEND (موجود)                          ❌ BACKEND (مفقود)
─────────────────────────                    ─────────────────────────
ManagedChannelsPage.tsx       ────متصل به──► [نیست] GET  /channels
ConnectChannelPage.tsx        ────متصل به──► [نیست] POST /channels/connect
ChannelDashboardPage.tsx      ────متصل به──► [نیست] GET  /channels/:id
ChannelGeneralSettingsPage    ────متصل به──► ⚠️ /groups/:id/settings (اشتباه)
ChannelPostingPage.tsx        ────متصل به──► [نیست] PUT  /channels/:id/posting
ChannelForwardingPage.tsx     ────متصل به──► [نیست] CRUD /channels/:id/rules
ChannelAdminsPage.tsx         ────متصل به──► [نیست] CRUD /channels/:id/admins
ChannelAnalyticsPage.tsx      ────متصل به──► ⚠️ /groups/:id/analytics (اشتباه)
ChannelInlineButtonsPage.tsx  ──ذخیره در──► 🔴 localStorage (!!)
ChannelDynamicBioPage.tsx     ──داده──────► 🔴 Mock فقط
ChannelAutoResponderPage.tsx  ──داده──────► 🔴 Mock فقط
ChannelAuditLogPage.tsx       ────متصل به──► ⚠️ /groups/:id/audit (اشتباه)
routes.tsx                    ✅ ۱۲ مسیر تعریف‌شده
```

---

# ۲. تحلیل دقیق فرانت‌اند

## ۲.۱ نقاط قوت

- ✅ **معماری FSD** (Feature-Sliced Design) رعایت شده
- ✅ **استک مدرن:** SolidJS + Vite + TailwindCSS v4 + Ark UI
- ✅ **`createResource`** برای data fetching که معادل TanStack Query در Solid است
- ✅ **i18n کامل** با `t()` و `isRtl()` (پشتیبانی RTL برای فارسی)
- ✅ **Optimistic Locking** در صفحه `general-settings` با `settingsVersion()` رعایت شده
- ✅ **Telegram Mini App SDK** (`@tma.js/sdk-solid`) به‌درستی استفاده می‌شود
- ✅ **Haptic Feedback** در همه‌جا (UX خوب)

## ۲.۲ مشکلات بحرانی فرانت‌اند

### 🔴 مشکل #۱: استفاده از `localStorage` در `ChannelInlineButtonsPage.tsx`
```tsx
// خطوط ۵۳-۶۵
const saved = localStorage.getItem(`channel_buttons_${params.id}`);
if (saved) {
  setButtons(JSON.parse(saved));
}
```
**خطر:**
- داده‌ها بین دستگاه‌ها همگام نیست
- در حالت Incognito پاک می‌شود
- در iOS Telegram Mini App محدودیت دارد
- **هیچ‌جا روی سرور ذخیره نمی‌شود**

### 🔴 مشکل #۲: Mock Data شدید
صفحات زیر کاملاً با داده‌های تستی کار می‌کنند:
- `ChannelAdminsPage.tsx` (خطوط ۳۲-۴۳): لیست ادمین‌ها و اعضا
- `ChannelAnalyticsPage.tsx` (خطوط ۲۹-۴۳): گراف رشد، توزیع جغرافیایی
- `ChannelAutoResponderPage.tsx`: کل state در حافظه
- `ChannelDynamicBioPage.tsx`: قیمت‌ها و متغیرها

### 🟠 مشکل #۳: ConnectChannelPage فقط `setTimeout` است
```tsx
// خط ۲۹-۳۶
setIsVerifying(true);
setTimeout(() => {        // ❌ Mock!
  setIsVerifying(false);
  showToast(t('connectChannel.success'), 'success');
  navigate('/managed-channels');
}, 1500);
```
هیچ API برای register کردن کانال فراخوانی نمی‌شود.

### 🟠 مشکل #۴: عدم Error Handling سیستماتیک
هیچ مدیریت خطای متمرکزی برای:
- `429 Too Many Requests` (rate limit)
- `409 Conflict` (optimistic lock)
- `403 Forbidden` (mandatory bot removal از کانال)
- Network errors

### 🟡 مشکل #۵: عدم وجود Loading Skeleton مناسب
بسیاری از صفحات فقط یک spinner دارند که UX را در شبکه‌های کند ضعیف می‌کند.

### 🟡 مشکل #۶: Bundle Size
کل ۱۲ صفحه کانال در `routes.tsx` با `lazy()` لود می‌شوند که خوب است، اما هر صفحه ۳۰۰-۵۸۰ خط است و کامپوننت‌های مشترک (مثل `SettingsSection`) بازنویسی شده.

---

# ۳. تحلیل دقیق بک‌اند

## ۳.۱ بزرگ‌ترین یافته: **بک‌اند کانال وجود ندارد**

با `grep` در کل بک‌اند:
```bash
grep -i "channel_post\|edited_channel_post" backend/internal/
# نتیجه: ❌ صفر مورد
```

تنها مرجع به "channel" در بک‌اند:
```go
// moderator_service.go:464
ForwardFromChannel: m.ForwardFromChat != nil && m.ForwardFromChat.Type == "channel"
```
این فقط برای **شناسایی فوروارد از کانال در یک گروه** است، نه برای مدیریت کانال!

### مدل ها فقط برای گروه نوشته شده:
```sql
-- migrations/000002_bot_management.up.sql
CREATE TABLE managed_groups (
    ...
    chat_type TEXT NOT NULL DEFAULT 'group' 
      CHECK (chat_type IN ('group', 'supergroup', 'channel')), -- channel هست
    members_count INT NOT NULL DEFAULT 0,  -- اما هیچ subscriber_count نیست
    ...
);
```
گرچه `'channel'` در CHECK constraint اضافه شده، اما هیچ منطقی برای آن نوشته نشده.

## ۳.۲ نقاط قوت بک‌اند موجود (که برای گروه است)

- ✅ **معماری Clean** (Handler / Service / Repository)
- ✅ **رمزنگاری Token با AES-GCM** (`EncryptToken` در `bot_service.go`)
- ✅ **Webhook Secret Token** اعتبارسنجی می‌شود (Patch 5)
- ✅ **Idempotency با SETNX** برای آپدیت‌های تکراری تلگرام (BUG #16)
- ✅ **CAS Integration** (Combot Anti-Spam) با کش ۲۴ ساعته
- ✅ **HMAC + Constant-Time Compare** برای TonAPI و InitData
- ✅ **Brute-Force Lock** با Redis (IP + User)
- ✅ **OpenTelemetry** در حال راه‌اندازی (کامیت اخیر)
- ✅ **PII Masking Logger** اضافه شده

## ۳.۳ مسائل بک‌اند موجود

| # | فایل | خط | مشکل | شدت |
|---|------|-----|------|------|
| B1 | `bot_service.go` | ۳۶۵ | `BOT_TOKEN_KEY` fallback به مقدار پیش‌فرض. **اگر env نباشد، همه توکن‌ها با کلید پیش‌فرض رمز می‌شوند!** | 🔴 بحرانی |
| B2 | `bot_service.go` | ۳۱۳ | `go s.frgRepo.DB().CreditReferrerShare(...)` — goroutine بدون context کنترل، اگر crash کند silent fail می‌شود | 🟠 بالا |
| B3 | `bot_service.go` | ۸۲-۱۱۴ | `CheckExpirations` با `time.Now().Hour() == 10` — اگر سرور در ساعت ۱۰ down باشد، نوتیف ارسال نمی‌شود + هیچ ضبط ارسال‌شدن نیست (race condition با چندین instance) | 🟠 بالا |
| B4 | `moderator_service.go` | ۲۷۹-۲۹۵ | `http.Get(CAS URL)` بدون timeout → اگر CAS کند پاسخ دهد، goroutine قفل می‌شود | 🟠 بالا |
| B5 | `moderator_service.go` | ۸۲-۹۹ | `s.cache.Client.Incr` بدون atomic check برای race در anti-raid trigger | 🟡 متوسط |
| B6 | `webhook.go` | ۴۱۹ | `h.moderator.GetCache().Client.Incr` — اگر `Client` nil باشد، **panic!** (nil pointer) — این اتفاقاً ۲۰ خط بالاتر چک شده ولی این خط جدا نیست | 🔴 بحرانی |
| B7 | `webhook.go` | ۵۳۲ | `os.Getenv("BOT_TOKEN")` در `answerPreCheckout` — یک ثابت سراسری برای **بات اصلی** بازگشت می‌دهد، نه بات کاربر! این پرداخت‌های users-bots را خراب می‌کند | 🔴 بحرانی |
| B8 | `webhook.go` | ۳۱۱ | `lang := i18n.DetectLanguage(bot.Status)` — `bot.Status` یک enum مثل `"active"` است نه کد زبان! این یک باگ تایپوگرافی است | 🟠 بالا |
| B9 | `settings_repo.go` | ۱۸۶-۱۹۵ | کش فقط روی موفقیت ست می‌شود اما در `initSettings` کش نمی‌شود → cache stampede ممکن | 🟡 متوسط |
| B10 | `audit_repo.go` | کل فایل | فقط `Log` و `GetByGroup`. **هیچ pagination مناسب، فیلتر action، export CSV یا retention policy نیست** | 🟠 بالا |
| B11 | `middleware/rate_limit.go` | ۹۸ | `ips map[string][]time.Time` در حافظه — در محیط multi-instance شکست می‌خورد (هرچند Redis fallback هست، اما اگر cache down شود؟) | 🟡 متوسط |
| B12 | `middleware/tg_initdata.go` | ۱۸۸ | replay attack window ۲۴ ساعت — خیلی زیاد است! توصیه: ≤۵ دقیقه | 🟠 بالا |
| B13 | `bot_mgmt.go` | ۲۲۹-۲۴۲ | `Subscribe` — اگر `Debit` موفق باشد ولی `UpdateGroupSubscription` شکست بخورد، refund می‌شود. **اما اگر refund هم شکست بخورد؟** هیچ retry/idempotency برای refund نیست | 🟠 بالا |
| B14 | `webhook.go` | ۱۹۶-۱۹۸ | `update.CallbackQuery` بدون idempotency check جدا → کاربر می‌تواند با کلیک سریع چندبار کپچا را trigger کند | 🟡 متوسط |
| B15 | `moderator_service.go` | ۴۵۸ | regex `BlockDomains` با `\b[\w-]+\.[a-z]{2,24}\b` → false positive روی `e.g.` , `etc.` , file extensions | 🟡 متوسط |

---

# ۴. تحلیل دیتابیس

## ۴.۱ مدل فعلی (`migrations/000002_bot_management.up.sql`)

```
managed_bots ──┐
               ├──< managed_groups (chat_type می‌تواند channel باشد ولی منطق نیست)
               │       │
               │       ├──< group_settings (۶ JSONB column)
               │       ├──< audit_logs
               │       └──< group_events
               │
               └──< billing_subscriptions
```

## ۴.۲ مشکلات مدل دیتابیس

### 🔴 D1: نام‌گذاری `managed_groups` با وجود کانال
جدول `managed_groups` نام دارد ولی قرار است کانال هم نگه دارد. این **debt** بزرگی است. باید یا rename شود به `managed_chats` یا یک جدول `managed_channels` جدا داشته باشد.

### 🔴 D2: فقدان فیلدهای اختصاصی کانال
کانال‌ها نیاز به این فیلدها دارند که موجود نیست:
- `subscribers_count` (متفاوت از `members_count`)
- `linked_chat_id` (Discussion group)
- `slow_mode_delay`
- `auto_delete_time` (TTL کانال)
- `sign_messages` (Setting)
- `protect_content`
- `discussion_chat_id`

### 🔴 D3: عدم وجود جداول مدیریت Inline Buttons
صفحه `ChannelInlineButtonsPage` باید روی DB ذخیره شود نه `localStorage`. نیاز به:
```sql
CREATE TABLE channel_inline_buttons (
    id UUID PRIMARY KEY,
    channel_id UUID REFERENCES managed_channels(id),
    title TEXT, value TEXT, type TEXT, style TEXT, emoji TEXT,
    position INT, ...
);
```

### 🔴 D4: عدم Partitioning برای `group_events` و `audit_logs`
این جدول‌ها در ماه اول هم ۱۰ میلیون رکورد خواهند داشت. باید پارتیشن‌بندی ماهانه شوند:
```sql
CREATE TABLE group_events (
    ...,
    created_at TIMESTAMPTZ
) PARTITION BY RANGE (created_at);
```

### 🟠 D5: ایندکس‌های جا افتاده
- `managed_groups(chat_id)` — هیچ ایندکس uniqueای روی `chat_id` تنها نیست (فقط روی `(bot_id, chat_id)`). Lookup با `chat_id` تنها از Webhook روزی میلیون‌ها بار اجرا می‌شود.
- `group_events(user_id, group_id, event_type, created_at)` — برای محاسبه warnings ضروری
- `audit_logs(action)` — برای فیلتر کردن لاگ‌ها

### 🟠 D6: عدم رمزنگاری ستون‌های حساس
`bot_token_encrypted` رمز شده ولی:
- `chat_title` ممکن است حاوی نام‌های شخصی باشد (GDPR)
- `payload` در `group_events` می‌تواند داده‌های حساس داشته باشد
- توصیه: استفاده از **pgcrypto** یا column-level encryption

### 🟠 D7: عدم وجود Soft Delete
هیچ‌جا `deleted_at` ندارد. این برای recovery, audit و GDPR ضروری است.

### 🟡 D8: عدم وجود Constraint برای داده‌های JSONB
ستون‌های JSONB در `group_settings` هیچ schema validation در سطح DB ندارند. می‌توان از **JSON Schema check constraint** (PostgreSQL 12+) استفاده کرد.

---

# ۵. یافته‌های بحرانی امنیتی

## 🚨 S1: BOT_TOKEN_KEY Fallback (CVSS: 9.8)
```go
// bot_service.go:362-368
keyStr := os.Getenv("BOT_TOKEN_KEY")
if keyStr == "" {
    slog.Warn("CRITICAL: BOT_TOKEN_KEY is not set...")
    keyStr = "default_fallback_key_32_chars_!!!" // ❌
}
```
**حمله:** اگر در deploy فراموش شود env را ست کنند، **تمام بات‌توکن‌ها با کلید عمومی** رمز می‌شوند. اگر DB لو برود، توکن‌ها قابل بازیابی هستند.

**اصلاح:**
```go
if keyStr == "" {
    panic("FATAL: BOT_TOKEN_KEY must be set in production")
}
if len(keyStr) != 32 {
    panic("FATAL: BOT_TOKEN_KEY must be exactly 32 bytes")
}
```

## 🚨 S2: BOT_TOKEN Hard-coded در Webhook (CVSS: 8.5)
```go
// webhook.go:532
func (h *WebhookHandler) answerPreCheckout(...) {
    botToken := os.Getenv("BOT_TOKEN")  // ❌
    url := fmt.Sprintf("https://api.telegram.org/bot%s/answerPreCheckoutQuery", botToken)
```
این فقط برای بات اصلی iFragment کار می‌کند، نه برای بات‌های ثبت‌شده کاربران. باید توکن بات صحیح برای آن `botID` گرفته شود.

## 🚨 S3: نبود اعتبارسنجی Channel Ownership (CVSS: 8.0)
هیچ‌جا چک نمی‌شود که آیا کاربر iFragment **مالک واقعی** کانال تلگرامی است یا نه. هرکس می‌تواند با ارسال یک `chat_id` کانال دیگری، آن را به حساب خود ثبت کند.

**اصلاح پیشنهادی:** Telegram MTProto API برای `channels.getParticipant` با حساب کاربر، یا مجبور کردن کاربر به اجرای دستوری در کانال که با login user مرتبط باشد.

## 🚨 S4: TonAPI Webhook Race Condition (CVSS: 7.0)
```go
// webhook.go:909
r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
```
بدنه دوبار خوانده می‌شود اما در حین آن، اگر دو وب‌هوک هم‌زمان بیایند، state race ممکن است.

## 🚨 S5: Replay Window 24h (CVSS: 6.5)
```go
// tg_initdata.go:188
if now-authDate > 86400 { return fmt.Errorf("init data expired") }
```
این پنجره ۲۴ ساعته یعنی اگر `init_data` کاربر در XSS لو برود، حمله‌گر ۲۴ ساعت زمان دارد. توصیه: ≤۵ دقیقه (مطابق توصیه رسمی Telegram).

## 🚨 S6: نبود CSRF Protection برای State-Changing Endpoints
`POST /channels/connect`, `DELETE /channels/:id` و ... اگر cookie-based session داشتند، CSRF token نیاز است. حالا چون JWT/Header-based است **نسبتاً امن**، ولی اگر در آینده cookie اضافه شود این نقطه ضعف می‌شود.

## 🚨 S7: SQL Injection Surface در `UpdateCategory`
```go
// settings_repo.go:236
query := fmt.Sprintf(`UPDATE group_settings SET %s = $1...`, category)
```
گرچه `category` با whitelist چک می‌شود (خط ۲۲۴-۲۲۸)، استفاده از `fmt.Sprintf` در SQL یک Anti-Pattern است. در آینده اگر کسی whitelist را دستکاری کند، آسیب‌پذیری ایجاد می‌شود.

## 🚨 S8: نبود Audit Log برای Failed Login Attempts
brute-force lock انجام می‌شود ولی **هیچ لاگ ثبت نمی‌شود**. در صورت حمله، forensics ناممکن است.

---

# ۶. یافته‌های منطقی و باگ‌ها

## ۶.۱ باگ‌های منطقی شناسایی‌شده

| # | فایل | شرح | اثر |
|---|------|-----|------|
| L1 | `webhook.go:419` | اگر `h.moderator.GetCache()` نیل برگرداند → `nil.Client.Incr` → **PANIC** | کرش کل سرور |
| L2 | `bot_service.go:105-106` | `time.Now().Hour() == 10` تنها در یک ساعت → اگر job ۱ ساعت طول بکشد، فقط یک ساعت چک می‌شود | از دست رفتن نوتیف expiry |
| L3 | `moderator_service.go:201-213` | ادمین تمام rule ها را bypass می‌کند **حتی keyword ها** که شاید نباید | کنترل ناقص |
| L4 | `moderator_service.go:386-389` | `RequiredChannels` چک می‌شود ولی **اگر بات admin کانال نباشد** خطا silent می‌شود (همه می‌گذرند!) | bypass force-join |
| L5 | `webhook.go:419-426` | `total_msgs:%d` کلید بدون expiry → milestone یکبار trigger می‌شود برای همیشه | UX خراب |
| L6 | `moderator_service.go:780-836` | `isSpamPattern` تشخیص "all-caps" برای متن فارسی **همیشه false** (فارسی case ندارد). نام خوب: `isASCIISpamPattern` | منطق ناقص برای فارسی |
| L7 | `bot_service.go:144-166` | `RegisterBot` هیچ‌جا چک نمی‌کند که آیا توکن **واقعاً معتبر** است (مثلاً با `getMe`) | امکان ذخیره توکن غلط |
| L8 | `webhook.go:330-356` | اگر `len(NewChatMembers)>0` و `LeftChatMember!=nil` همزمان باشند، فقط join handle می‌شود | edge case |
| L9 | `moderator_service.go:74-99` | `checkAntiRaid` بعد از trigger، lockdown را فعال می‌کند ولی **هیچ‌گاه آن را غیرفعال نمی‌کند**. باید TTL یا cooldown داشته باشد | قفل دائمی! |
| L10 | `settings_repo.go:225` | `version + 1` در WHERE → اگر دو client هم‌زمان `version=5` ارسال کنند، یکی موفق و یکی conflict. خوب است. اما... اگر `version` در DB ۱۰ باشد و client `version=5` بفرستد، هیچ مقایسه‌ای از نوع conflict نشان نمی‌دهد، فقط `ErrOptimisticLockConflict` می‌دهد بدون اطلاع که مقدار جدید چیست | UX ضعیف |
| L11 | `bot_mgmt.go:36-43` | type assertion برای `id` به ۳ نوع — اگر None باشد، صفر برمی‌گردد. اما `getUserID() == 0` چک نمی‌کند که `id` `0` باشد یا واقعاً missing | edge case |
| L12 | `bot_service.go:307-308` | `_, _ = s.frgRepo.Credit(...)` — refund بدون retry. اگر شکست بخورد، کاربر **هم پول داده، هم اشتراک ندارد** | از دست رفتن پول! |

## ۶.۲ Compile-Time Risk
کد خوب compile می‌شود (Go 1.21+) و هیچ syntax error واضحی نیست. ولی این چند مورد warning زا هستند:
- `_ "..."` بسیار زیاد در `main.go`
- `var _ redis.Client` در `moderator_service.go:859` — یک hack برای import unused

---

# ۷. مسائل عملکرد و مقیاس‌پذیری

## 🐢 P1: همه `GetChatMember` کوئری‌ها sync و blocking هستند
هر پیام در یک گروه = ۱ تماس به Telegram. حتی با کش ۵ دقیقه، با ۱۰۰۰ گروه فعال = ۱۰۰۰ req/min به Telegram → flood wait.

**راه‌حل:** Pub-Sub با `chat_member` updates از Telegram و کش طولانی‌مدت‌تر.

## 🐢 P2: PII Logger در Hot Path
PII masking برای **هر** log اجرا می‌شود، که در hot path (webhook handler) overhead دارد.

## 🐢 P3: Telegram BotAPIClient Cache بدون اخراج (Eviction)
```go
// moderator_service.go:32
clientCache sync.Map // botID -> *telegram.BotAPIClient
```
هیچ‌گاه ورودی‌ها پاک نمی‌شوند. با ۱۰۰هزار بات → memory leak.

## 🐢 P4: عدم Worker Pool
هر webhook یک goroutine می‌سازد (به‌خاطر `go func()` در webhook.go:598). با حمله DDoS → unbounded goroutines.

## 🐢 P5: عدم Read-Replica
همه کوئری‌ها از یک DB می‌خوانند. باید read-only queries (مثل analytics) به read replica روند.

## 🐢 P6: عدم Connection Pooling Tuning
هیچ تنظیم صریحی برای `pgx.MaxConns`, `MaxIdleConns` در کد دیده نشد.

## 🐢 P7: JSON Marshal/Unmarshal در Hot Path
`ValidateMessage` در هر پیام ۶ بار JSON unmarshal می‌کند. باید با `[]byte caching` بهینه شود.

---

# ۸. انطباق با Telegram API

## ۸.۱ نکات مهم Telegram Bot API برای کانال

طبق [Telegram Bot API Documentation](https://core.telegram.org/bots/api):

### نوع‌های Update مخصوص کانال:
- `channel_post` — پست جدید در کانال
- `edited_channel_post` — پست ویرایش‌شده
- `chat_member` — تغییر عضویت (نیاز به `allowed_updates`)
- `message_reaction` و `message_reaction_count` (نیاز به admin بودن بات)

### محدودیت‌ها:
- بات‌ها فقط با **admin بودن در کانال** می‌توانند پست بفرستند
- بات‌ها **نمی‌توانند ادمین کانال را تغییر دهند** (`channels.editAdmin` فقط در MTProto)
- محدودیت ارسال: ۳۰ پیام/ثانیه گلوبال، ۲۰ پیام/دقیقه per group/channel
- محدودیت broadcast: کاربر ۸-۱۲ ساعت بین broadcast بزرگ

## ۸.۲ شکاف‌های فعلی پروژه نسبت به Telegram

| ویژگی Telegram | پشتیبانی فعلی | اولویت |
|----------------|----------------|---------|
| `channel_post` در webhook | ❌ صفر | 🔴 P0 |
| `edited_channel_post` | ❌ صفر | 🔴 P0 |
| `message_reaction` (تعداد لایک) | ❌ صفر | 🟠 P1 |
| `chat_member` updates | ❌ صفر | 🔴 P0 |
| `copyMessage` (برای forwarding) | ❌ صفر | 🔴 P0 |
| `editMessageText/Caption` | ❌ صفر | 🟠 P1 |
| `pinChatMessage` | ✅ هست (در groups) | - |
| `deleteMessages` (bulk) | ❌ فقط delete تکی | 🟡 P2 |
| `getChatMemberCount` | ❌ صفر | 🟠 P1 |
| `setChatPhoto` / `setChatTitle` | ❌ صفر | 🟠 P1 (برای Dynamic Bio) |
| `setChatDescription` | ❌ صفر | 🔴 P0 (Dynamic Bio) |
| `setChatPermissions` (group only) | ❌ صفر | 🟡 P2 |
| `setChatAdministratorCustomTitle` | ❌ صفر | 🟠 P1 (Admins page) |
| `promoteChatMember` | ❌ صفر | 🟠 P1 |
| `restrictChatMember` | ✅ هست | - |
| `banChatMember/unban` | ✅ هست | - |
| `forwardMessage/copyMessage` | ❌ Forwarding page وجود دارد ولی API نه | 🔴 P0 |
| `sendMessage` با `disable_notification` | جزئی | 🟡 P2 |
| `sendMediaGroup` | ❌ صفر | 🟠 P1 (Posting) |
| Stars Payment (XTR) | ✅ ابتدایی | - |
| Telegram Premium check | جزئی | 🟡 P2 |
| `chat_join_request` events | ❌ صفر | 🔴 P0 |

## ۸.۳ Rate Limit Strategy نیاز است

طبق [grammY docs](https://grammy.dev/advanced/flood):
- ۱ پیام/ثانیه per chat
- ۳۰ پیام/ثانیه گلوبال
- ۲۰ پیام/دقیقه در group

نیاز است یک **broadcast queue** با retry و exponential backoff داشته باشیم. نمی‌توان فقط `_ = tg.SendMessage(...)` نوشت.

---

# ۹. نقشه راه ۰ تا ۱۰۰

> این روادمپ ۷۳ نمره باقی‌مانده را بازیابی می‌کند و در ۶ فاز چیده شده.

## 🔵 فاز ۱ — پایه دیتابیس و مدل کانال (+۱۵ نمره | ۲ هفته)

### مهاجرت‌های موردنیاز:

```sql
-- migration 000009_channel_management.up.sql

-- 1. Separate channels from groups (یا rename managed_groups → managed_chats)
ALTER TABLE managed_groups RENAME TO managed_chats;

-- 2. اضافه کردن فیلدهای اختصاصی کانال
ALTER TABLE managed_chats
  ADD COLUMN subscribers_count INT NOT NULL DEFAULT 0,
  ADD COLUMN linked_chat_id BIGINT,
  ADD COLUMN slow_mode_delay INT DEFAULT 0,
  ADD COLUMN auto_delete_time INT DEFAULT 0,
  ADD COLUMN sign_messages BOOLEAN DEFAULT false,
  ADD COLUMN protect_content BOOLEAN DEFAULT false,
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- 3. ایندکس مهم
CREATE UNIQUE INDEX idx_managed_chats_chat_id ON managed_chats(chat_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_managed_chats_owner_type ON managed_chats(chat_type, deleted_at) WHERE deleted_at IS NULL;

-- 4. جدول اختصاصی پست‌های کانال (برای آمار، edit history)
CREATE TABLE channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES managed_chats(id) ON DELETE CASCADE,
  telegram_message_id BIGINT NOT NULL,
  author_user_id BIGINT,
  text TEXT,
  has_media BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  reactions_count INT DEFAULT 0,
  forwards_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, telegram_message_id)
) PARTITION BY RANGE (created_at);

-- 5. Inline buttons (انتقال از localStorage)
CREATE TABLE channel_inline_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES managed_chats(id) ON DELETE CASCADE,
  preset TEXT, title TEXT NOT NULL, value TEXT NOT NULL,
  type TEXT NOT NULL, style TEXT, emoji TEXT,
  position INT DEFAULT 0,
  click_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Auto-responder rules
CREATE TABLE channel_autoresponder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES managed_chats(id) ON DELETE CASCADE,
  keywords TEXT[] NOT NULL,
  match_type TEXT CHECK (match_type IN ('exact','contains','regex')),
  reply_text TEXT,
  use_ai BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Forwarding rules
CREATE TABLE channel_forwarding_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES managed_chats(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  target_type TEXT CHECK (target_type IN ('telegram','webhook')),
  target TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('forward','copy','ai')),
  remove_ads BOOLEAN DEFAULT false,
  remove_hashtags BOOLEAN DEFAULT false,
  remove_links BOOLEAN DEFAULT false,
  watermark TEXT,
  delay_seconds INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Dynamic bio templates
CREATE TABLE channel_bio_templates (
  channel_id UUID PRIMARY KEY REFERENCES managed_chats(id) ON DELETE CASCADE,
  bio_template TEXT,
  name_template TEXT,
  update_interval TEXT DEFAULT '10m',
  enabled BOOLEAN DEFAULT true,
  display_in_name BOOLEAN DEFAULT false,
  countdown_target_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
);
```

### چک‌لیست این فاز:
- [ ] ساخت تمام migration ها (up + down)
- [ ] اضافه کردن `chat_join_request` event type به `group_events`
- [ ] Partitioning ماهانه برای `group_events`, `audit_logs`, `channel_posts`
- [ ] CHECK constraint روی JSON schema
- [ ] اضافه کردن `pgcrypto` و رمزنگاری ستون‌های حساس

---

## 🟢 فاز ۲ — لایه Service و Repository (+۱۸ نمره | ۳ هفته)

### پکیج جدید: `internal/service/channelmgmt/`

```go
// internal/service/channelmgmt/channel_service.go
package channelmgmt

type ChannelService struct {
    chatRepo       *repository.ChatRepo  // renamed from BotRepo
    settingsRepo   *repository.SettingsRepo
    postRepo       *repository.ChannelPostRepo
    buttonRepo     *repository.InlineButtonRepo
    forwarderRepo  *repository.ForwarderRepo
    autoresponderRepo *repository.AutoresponderRepo
    bioRepo        *repository.BioRepo
    auditRepo      *repository.AuditRepo
    cache          *repository.Cache
    rateLimiter    *RateLimiter
}

// Methods needed:
func (s *ChannelService) ConnectChannel(ctx, userID, chatID) (*Channel, error)
func (s *ChannelService) DisconnectChannel(ctx, channelID, userID) error
func (s *ChannelService) ListUserChannels(ctx, userID) ([]Channel, error)
func (s *ChannelService) GetChannelStats(ctx, channelID) (*ChannelStats, error)

// Posting
func (s *ChannelService) SchedulePost(ctx, ...) (*PostJob, error)
func (s *ChannelService) PublishNow(ctx, ...) (*Post, error)
func (s *ChannelService) ListScheduledPosts(ctx, channelID) ([]PostJob, error)

// Forwarding
func (s *ChannelService) CreateForwardingRule(ctx, ...) (*Rule, error)
func (s *ChannelService) ListForwardingRules(ctx, channelID) ([]Rule, error)
func (s *ChannelService) ProcessForwarding(ctx, srcChatID, msg) error

// Admins (via MTProto since Bot API can't promote)
func (s *ChannelService) PromoteAdmin(ctx, userID, channelID, perms) error  // Needs MTProto
func (s *ChannelService) DemoteAdmin(ctx, userID, channelID) error
func (s *ChannelService) SetAdminCustomTitle(ctx, userID, channelID, title) error  // Bot API OK

// Inline Buttons
func (s *ChannelService) AddInlineButton(ctx, channelID, btn) error
func (s *ChannelService) HandleButtonClick(ctx, callbackData) error

// Auto-responder
func (s *ChannelService) MatchAndReply(ctx, channelID, msgText) (*Reply, error)

// Dynamic Bio
func (s *ChannelService) UpdateBio(ctx, channelID) error  // Background job
```

### چک‌لیست این فاز:
- [ ] جدا کردن `ChatRepo` (rename `BotRepo`) با channel awareness
- [ ] پیاده‌سازی **همه ۳۰+ متد** بالا
- [ ] اضافه کردن **integration tests** برای هر متد (≥۸۰٪ coverage)
- [ ] **MTProto Client** برای عملیاتی که Bot API انجام نمی‌دهد
- [ ] **Rate Limiter اختصاصی هر بات** با token bucket algorithm
- [ ] **Broadcast Queue** برای پیام‌های انبوه (با Redis Stream)

---

## 🟡 فاز ۳ — Handler ها و API Layer (+۱۰ نمره | ۲ هفته)

### Endpoint های جدید نیاز:

```go
// در main.go، route ها:
r.Route("/channels", func(r chi.Router) {
    r.Use(middleware.AuthMiddleware)
    
    r.Get("/", channelHandler.ListUserChannels)
    r.Post("/connect", channelHandler.ConnectChannel)
    r.Route("/{channelID}", func(r chi.Router) {
        r.Use(middleware.ChannelOwnerOnly)  // ← اعتبارسنجی مالکیت
        
        r.Get("/", channelHandler.GetChannel)
        r.Delete("/", channelHandler.DisconnectChannel)
        
        // Settings (6 categories)
        r.Get("/settings", channelHandler.GetSettings)
        r.Patch("/settings/{category}", channelHandler.UpdateSettings)
        
        // Posting
        r.Get("/posts", channelHandler.ListPosts)
        r.Post("/posts", channelHandler.CreatePost)
        r.Put("/posts/{postID}", channelHandler.EditPost)
        r.Delete("/posts/{postID}", channelHandler.DeletePost)
        r.Get("/scheduled", channelHandler.ListScheduled)
        
        // Forwarding
        r.Route("/forwarding", func(r chi.Router) {
            r.Get("/rules", channelHandler.ListForwardingRules)
            r.Post("/rules", channelHandler.CreateForwardingRule)
            r.Put("/rules/{ruleID}", channelHandler.UpdateForwardingRule)
            r.Delete("/rules/{ruleID}", channelHandler.DeleteForwardingRule)
        })
        
        // Admins
        r.Route("/admins", func(r chi.Router) {
            r.Get("/", channelHandler.ListAdmins)
            r.Post("/", channelHandler.PromoteAdmin)
            r.Patch("/{adminID}", channelHandler.UpdateAdminPerms)
            r.Delete("/{adminID}", channelHandler.DemoteAdmin)
        })
        
        // Analytics
        r.Get("/analytics", channelHandler.GetAnalytics)
        r.Get("/analytics/growth", channelHandler.GetGrowth)
        r.Get("/analytics/posts", channelHandler.GetTopPosts)
        r.Get("/analytics/competitors", channelHandler.CompareWithCompetitor)
        
        // Inline Buttons
        r.Route("/buttons", func(r chi.Router) {
            r.Get("/", channelHandler.ListButtons)
            r.Post("/", channelHandler.CreateButton)
            r.Put("/{btnID}", channelHandler.UpdateButton)
            r.Delete("/{btnID}", channelHandler.DeleteButton)
            r.Get("/{btnID}/stats", channelHandler.ButtonStats)
        })
        
        // Dynamic Bio
        r.Get("/bio", channelHandler.GetBioTemplate)
        r.Put("/bio", channelHandler.UpdateBioTemplate)
        
        // Auto-responder
        r.Route("/autoresponder", func(r chi.Router) {
            r.Get("/rules", channelHandler.ListAutoResponderRules)
            r.Post("/rules", channelHandler.CreateAutoResponderRule)
            r.Put("/rules/{ruleID}", channelHandler.UpdateAutoResponderRule)
            r.Delete("/rules/{ruleID}", channelHandler.DeleteAutoResponderRule)
        })
        
        // Audit
        r.Get("/audit", channelHandler.GetAuditLog)
        r.Get("/audit/export", channelHandler.ExportAuditCSV)
    })
})
```

### Webhook Handler — افزودن `channel_post`:
```go
// webhook.go باید اضافه کند:
type TelegramUpdate struct {
    ...
    ChannelPost       *Message `json:"channel_post"`
    EditedChannelPost *Message `json:"edited_channel_post"`
    ChatMember        *ChatMemberUpdated `json:"chat_member"`
    ChatJoinRequest   *ChatJoinRequest   `json:"chat_join_request"`
    MessageReaction   *MessageReactionUpdated `json:"message_reaction"`
}

// و در allowed_updates Webhook setup:
setWebhook(url, allowed_updates=[
    "message", "edited_message", "channel_post", "edited_channel_post",
    "callback_query", "chat_member", "my_chat_member",
    "chat_join_request", "message_reaction"
])
```

### چک‌لیست این فاز:
- [ ] ساخت تمام endpoint های بالا
- [ ] **OpenAPI/Swagger spec** کامل
- [ ] **Postman/Insomnia collection** برای QA
- [ ] **Request validation** با `go-playground/validator`
- [ ] **Response normalization** (هیچ `interface{}` در response نباشد)
- [ ] **API versioning** (`/v1/channels/...`)

---

## 🟠 فاز ۴ — اتصال Frontend به Backend (+۱۲ نمره | ۲ هفته)

### ۱. ساخت `shared/api/channel-management.ts`:
```typescript
import { hey } from '@/shared/api/client';  // Hey-API generated

export const channelApi = {
  // فعلاً موجود نیست — این فایل را باید بسازید
  getUserChannels: (userId: string) => hey.GET('/channels'),
  getChannel: (id: string) => hey.GET('/channels/{channelID}', {...}),
  connectChannel: (chatId: string) => hey.POST('/channels/connect', {...}),
  getSettings: (id: string) => hey.GET('/channels/{channelID}/settings', {...}),
  updateSettings: (id, category, data, version) =>
    hey.PATCH('/channels/{channelID}/settings/{category}', {...}),
  getAnalytics: (id, days) => hey.GET('/channels/{channelID}/analytics', {...}),
  getAuditLogs: (id, limit) => hey.GET('/channels/{channelID}/audit', {...}),
  // ... تقریباً ۴۰ متد دیگر
};
```

### ۲. حذف Mock Data:
- `ChannelAdminsPage`: حذف خطوط ۳۲-۴۳ (mock admins)
- `ChannelAnalyticsPage`: حذف `growthData`, `geoDistribution`, `similarChannels`
- `ChannelDynamicBioPage`: حذف `variables` و گرفتن از API
- `ChannelInlineButtonsPage`: حذف `localStorage`

### ۳. اضافه کردن Error Boundary:
```tsx
// در root
<ErrorBoundary fallback={(err, reset) => 
  <ChannelErrorScreen err={err} onRetry={reset}/>
}>
  <Routes>...</Routes>
</ErrorBoundary>
```

### چک‌لیست این فاز:
- [ ] **Hey-API codegen** از OpenAPI spec
- [ ] حذف **همه** mock data ها
- [ ] حذف **همه** `setTimeout()` fake delay ها
- [ ] **TanStack Query** wrapper برای cache + retry
- [ ] **Toast errors** برای ۴xx و ۵xx
- [ ] **Optimistic updates** برای toggle ها (مثل buttons)
- [ ] **Form validation** با Valibot قبل از submit
- [ ] **Bundle analyzer** (`pnpm run analyze`) برای کاهش سایز

---

## 🟣 فاز ۵ — تست، امنیت و QA (+۱۰ نمره | ۲ هفته)

### تست‌ها:
```
unit tests:
  - moderator_service_test.go (موجود — توسعه دهید)
  - channel_service_test.go (جدید)
  - settings_repo_test.go (جدید)
  - webhook_handler_test.go (جدید)

integration tests:
  - تست با PostgreSQL واقعی (testcontainers-go)
  - تست با Redis واقعی
  - تست با Telegram webhook simulator

E2E tests:
  - Playwright برای فلوهای کلیدی:
    1. Register bot → Connect channel → Send post → Analytics
    2. Force-join setup → New member join → Verification
    3. Forwarding rule → Trigger → Verify destination
    4. Subscription expiry → Notification → Renew
```

### امنیت (رفع همه ۸ یافته):
- [ ] **S1:** حذف BOT_TOKEN_KEY fallback (panic در صورت نبود)
- [ ] **S2:** اصلاح `answerPreCheckout` با توکن صحیح هر بات
- [ ] **S3:** اعتبارسنجی Channel Ownership (با MTProto check)
- [ ] **S4:** اضافه کردن mutex برای TonAPI webhook
- [ ] **S5:** کاهش InitData window به ۳۰۰ ثانیه
- [ ] **S6:** اضافه کردن CSRF tokens
- [ ] **S7:** پارامتر `category` به‌جای `fmt.Sprintf`، با switch case درست
- [ ] **S8:** ثبت brute-force attempts در audit_logs

### Penetration Testing:
- [ ] OWASP Top 10 audit
- [ ] دستی: SQL Injection, XSS, CSRF, IDOR
- [ ] **Bug bounty program** قبل از prod

---

## 🔴 فاز ۶ — Production Hardening (+۸ نمره | ۲ هفته)

### Observability:
- [x] OpenTelemetry (شروع شده — کامل کنید)
- [ ] **Prometheus metrics** برای every service method
- [ ] **Grafana dashboards** برای:
  - Webhook latency (p50/p95/p99)
  - DB connection pool usage
  - Redis hit rate
  - Telegram API error rates
  - Active users / active channels
- [ ] **Alerting** با Alertmanager (PagerDuty/Slack)

### Infrastructure:
- [ ] **Multi-instance deployment** (Kubernetes)
- [ ] **DB read-replicas** برای analytics queries
- [ ] **CDN** برای static frontend
- [ ] **Cloudflare/Vercel** برای DDoS protection
- [ ] **Backup strategy** — Postgres WAL archiving + daily dumps
- [ ] **Disaster Recovery plan** — RTO < 1h, RPO < 5min

### CI/CD:
- [ ] **GitHub Actions** برای:
  - lint (golangci-lint + biome)
  - test
  - security scan (gosec + Snyk)
  - build
  - deploy to staging
  - smoke test
  - canary deploy to prod
- [ ] **Pre-commit hooks** (Lefthook — موجود) با gofmt + go vet
- [ ] **Dependabot** برای lib updates

### Compliance:
- [ ] **GDPR**: حق فراموشی، export داده
- [ ] **Telegram TOS**: انطباق با قوانین Bot Platform
- [ ] **Privacy policy** و **Terms of Service**

---

# ۱۰. چک‌لیست رفتن به Production

این چک‌لیست **آخرین خط دفاع** قبل از deploy است:

## ⚪ کد و کیفیت
- [ ] هیچ `TODO` یا `FIXME` بحرانی نمانده
- [ ] هیچ `panic()` در hot path نیست
- [ ] هیچ `os.Exit()` در service ها نیست (فقط main.go)
- [ ] هیچ hard-coded credential در کد نیست
- [ ] `go vet` و `golangci-lint` بدون warning پاس می‌شوند
- [ ] `biome check` فرانت بدون error
- [ ] code coverage > ۸۰٪
- [ ] هیچ console.log در فرانت نمانده

## 🔒 امنیت
- [ ] همه env های secret در vault هستند (نه `.env`)
- [ ] HTTPS اجباری (HSTS preload)
- [ ] CSP درست تنظیم شده (موجود است — تست شود)
- [ ] CORS فقط برای دامنه‌های مجاز
- [ ] Rate limiting برای **همه** endpoint ها
- [ ] هیچ stack trace به کاربر نهایی برنمی‌گردد
- [ ] Webhook secret token چرخش می‌کند (rotation)
- [ ] BOT_TOKEN_KEY در KMS یا HSM
- [ ] DB credentials با IAM authentication

## 📊 Observability
- [ ] Health check endpoint `/healthz`, `/readyz`
- [ ] Liveness و Readiness probe در Kubernetes
- [ ] Structured logging (JSON) به ELK/Loki
- [ ] Distributed tracing (Jaeger/Tempo)
- [ ] Metrics به Prometheus
- [ ] Sentry برای frontend errors (موجود است)

## 🚀 Performance
- [ ] Load test با k6/locust:
  - ۱۰,۰۰۰ concurrent webhook
  - ۱,۰۰۰ concurrent UI users
  - p95 < 200ms برای API
- [ ] DB indexes تأیید شده با `EXPLAIN ANALYZE`
- [ ] Cache hit rate > ۸۰٪
- [ ] Memory profile با pprof
- [ ] CPU profile با pprof

## 🔄 Reliability
- [ ] Graceful shutdown (موجود است — تست شود)
- [ ] Circuit breaker برای Telegram API
- [ ] Retry با exponential backoff
- [ ] Idempotency برای **همه** state-changing endpoint ها
- [ ] DLQ (Dead Letter Queue) برای failed webhooks

## 📜 Compliance & Legal
- [ ] Privacy Policy نوشته‌شده
- [ ] Terms of Service نوشته‌شده
- [ ] انطباق با [Telegram Bot Platform Terms](https://telegram.org/tos/bot-developers)
- [ ] انطباق با Telegram TON Connect Policy (در صورت پرداخت TON)
- [ ] Cookie consent (در صورت نیاز)

## 🧪 آخرین تست‌ها
- [ ] Staging environment با data واقعی
- [ ] UAT با ۱۰ بتاتستر
- [ ] Smoke test پس از deploy
- [ ] Rollback plan تست شده
- [ ] On-call rotation تعیین شده

---

# 📌 جمع‌بندی نهایی

## نمره فعلی: **۲۷ / ۱۰۰**

این عدد **معکوس‌کننده** کیفیت کد نیست — کد نوشته‌شده **به‌نسبه خوب** نوشته شده. اما **حجم آنچه نوشته نشده** بسیار زیاد است.

## ۳ نکته که باید همین حالا انجام دهی:

1. 🚨 **رفع باگ‌های CRITICAL** (S1, S2, B6, B7) — این‌ها در حال حاضر در پروژه‌ای که برای گروه است وجود دارند و می‌توانند سرور را down کنند.

2. 🏗️ **شروع فاز ۱** (مدل دیتابیس کانال) — بدون این، هیچ‌کار دیگری نمی‌توان کرد.

3. 📐 **تصمیم استراتژیک:** آیا می‌خواهی **یک جدول `managed_chats`** برای گروه+کانال داشته باشی (با polymorphism)، یا **دو جدول جدا** (`managed_groups` + `managed_channels`)؟ این تصمیم architecture-defining است.

## تخمین زمان رسیدن به ۱۰۰:
- یک توسعه‌دهنده full-stack تنها: **۳-۴ ماه**
- تیم ۳ نفره (backend + frontend + DevOps): **۶-۸ هفته**
- تیم ۵ نفره با security engineer: **۴-۶ هفته**

## تخمین هزینه ابری (ماهانه، برای ۱۰هزار کانال فعال):
- PostgreSQL Managed (16GB RAM): ~$۲۵۰
- DragonflyDB / Redis: ~$۱۰۰
- Kubernetes (3 node): ~$۳۰۰
- Telegram API: رایگان (با rate limit)
- Sentry + DataDog: ~$۲۰۰
- **مجموع: ~$۸۵۰/ماه**

---

> این گزارش بر اساس commit `75ba6e3` تهیه شده و در صورت تغییرات بعدی نیاز به بازبینی دارد.

**موفق باشی! این پروژه پتانسیل بزرگی دارد، فقط نیاز به سرمایه‌گذاری روی بخش بک‌اند کانال دارد. 🚀**
