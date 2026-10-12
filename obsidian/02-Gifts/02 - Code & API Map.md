---
title: "🗺️ Telegram Gifts — Code & API Map"
tags:
  - domain
  - gifts
  - gvengine
  - ifragment
  - tep62
type: vertical-domain
status: production
---

# 🗺️ Telegram Gifts — Code & API Map

نقشه جامع مسیر فایل‌های سورس‌کد، اندپوینت‌های شبکه، جداول دیتابیس و صفحات فرانت‌اند **گیفت‌های تلگرام**.

---

## 🌐 ۱. روت‌های شبکه و API Backend

تعریف شده در: [`backend/internal/router/router.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/router/router.go#L142-L163)

| متد | مسیر روت | هندلر مربوطه | هدف و توضیحات |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/gifts/intel` | `cfg.GiftsHandler.GetIntel` | شاخص‌های ماکروی کل بازار گیفت‌ها و حجم ۲۴ ساعته |
| `GET` | `/api/v1/gifts/collections` | `cfg.GiftsHandler.ListCollections` | لیست تمام مجموعه‌های موجود گیفت‌ها با کف قیمت |
| `GET` | `/api/v1/gifts/collection-intel` | `cfg.GiftsHandler.GetCollectionIntel` | داده‌های عمیق تحلیلی یک کالکشن (هیت‌مپ ویژگی‌ها، فروش‌ها) |
| `GET` | `/api/v1/gifts/gate` | `cfg.GiftsHandler.GetCuriosityGate` | درگاه کنجکاوی (تیزر قبل از پرداخت و کسر کریدیت) |
| `GET` | `/api/v1/gifts/upgrade-advice` | `cfg.GiftsHandler.GetUpgradeAdvice` | تحلیل پلکان مزایده هلندی تلگرام برای بهینه‌سازی ارتقا |
| `GET` | `/api/v1/gifts/portfolio` | `cfg.GiftsHandler.ScanPortfolio` | اسکن دارایی‌های گیفت کاربر در والت‌های متصل |
| `POST`| `/api/v1/gifts/crafting-ev` | `cfg.GiftsHandler.CalculateCraftingEV` | شبیه‌سازی مونت‌کارلو برای ارزش مورد انتظار ساخت گیفت |
| `GET` | `/api/v1/gifts/valuate` | `cfg.GiftsHandler.Valuate` | محاسبه قیمت عادلانه گیفت با موتور GV-Engine |
| `GET` | `/api/v1/gifts/enriched-report` | `cfg.GiftsHandler.GetEnrichedReport` | گزارش ۱۰ بخشی کامل و تضمین ارزش دارایی |
| `GET` | `/api/v1/gifts/arbitrage` | `cfg.GiftsHandler.GetArbitrageRadar` | رادار آربیتراژ بین بازارهای مختلف (Fragment, Getgems, etc.) |
| `GET` | `/api/v1/gifts/whales` | `cfg.GiftsHandler.GetWhales` | ردیابی هولدرهای بزرگ و نهنگ‌های گیفت‌های تلگرام |
| `GET` | `/api/v1/gifts/serials/classify` | `cfg.GiftsHandler.ClassifySerial` | تحلیل و ارزش‌گذاری پترن شماره صدور (Serial ID) |

---

## 📂 ۲. سورس‌کد بک‌اند (Backend Files)

- **هندلر اصلی:** [`backend/internal/handler/gifts_handler.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/handler/gifts_handler.go)
- **سرویس اصلی:** [`backend/internal/service/gifts/gifts_service.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/gifts/gifts_service.go)
- **موتور ارزش‌گذاری:** [`backend/internal/service/gifts/gvengine/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/gifts/gvengine/)
- **ریپازیتوری دیتابیس:** [`backend/internal/repository/gifts_repo.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/repository/gifts_repo.go)
- **مستندات مرجع عمیق در پروژه:**
  - AI Spec کامل: [`docs/TELEGRAM_GIFTS_AI_SPEC.md`](file:///c:/Users/DEll/Desktop/iFragment/docs/TELEGRAM_GIFTS_AI_SPEC.md)
  - دانشنامه جامع: [`docs/telegram_gifts_encyclopedia.md`](file:///c:/Users/DEll/Desktop/iFragment/docs/telegram_gifts_encyclopedia.md)

---

## 🗄️ ۳. مایگریشن‌ها و جداول PostgreSQL

فایل‌های اسکریپت در [`backend/migrations/`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/):
1. [`000072_telegram_gifts_vertical.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000072_telegram_gifts_vertical.up.sql) — زیرساخت اولیه و جداول پایه گیفت‌ها
2. [`000083_gift_sales_idempotency_and_venues.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000083_gift_sales_idempotency_and_venues.up.sql) — اتصال به ونسیوهای مختلف و ثبت ایمن فروش‌ها
3. [`000084_gifts_market_engine_and_freshness.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000084_gifts_market_engine_and_freshness.up.sql) — ردیابی زنده تغییرات مارکت و تازگی داده‌ها
4. [`000085_gifts_omni_analytics_and_arbitrage.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000085_gifts_omni_analytics_and_arbitrage.up.sql) — موتور تحلیلی اومنی و جدول آربیتراژ
5. [`000101_gift_sales_trait_awareness.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000101_gift_sales_trait_awareness.up.sql) — ثبت داده‌های صفات ژنتیکی (Traits) در تاریخچه معاملات

---

## 💻 ۴. فرانت‌اند SolidJS (Frontend UI)

پوشه کامپوننت‌ها و صفحات: [`frontend/src/pages/gifts/`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/)
- **داشبورد کلان و کالکشن‌ها:** `GiftsIntelPage.tsx`
- **صفحه تحلیل عمیق کالکشن:** `GiftCollectionPage.tsx`
- **کارت سه‌بعدی و گزارش تحلیلی:** `GiftReportPage.tsx`
- **ماشین‌حساب کرفتینگ و شبیه‌ساز:** `CraftingCalculatorPage.tsx`
- **اسکنر پورتفولیو:** `PortfolioScannerPage.tsx`

---

## 🔗 اسناد مرتبط:
- [[00 - Overview & Business Rules]] — قوانین کسب‌وکار و مارکت‌ها
- [[01 - Technical Architecture & GVEngine]] — معماری موتور و فرمول‌ها
- [[03 - Agent Task Template - Gifts]] — قالب تسک‌دهی به ایجنت
