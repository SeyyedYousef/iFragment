---
title: "🗺️ Usernames — Code & API Map"
tags:
  - avm
  - domain
  - ifragment
  - usernames
type: vertical-domain
status: production
---

# 🗺️ Usernames — Code & API Map

راهنمای قطعی مکان تمام فایل‌های سورس‌کد، جداول دیتابیس و روت‌های API مرتبط با **یوزرنیم‌ها**. هر ایجنت باید تغییرات خود را مستقیماً در این فایل‌ها اعمال کند.

---

## 🌐 ۱. روت‌های شبکه و API Backend

تعریف شده در: [`backend/internal/router/router.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/router/router.go#L88-L110)

| متد | مسیر روت | هندلر مربوطه | هدف و توضیحات |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/usernames/check` | `cfg.UsernameHandler.CheckAvailability` | بررسی ثبت بودن یا آزاد بودن یوزرنیم در تلگرام |
| `GET` | `/api/v1/usernames/quick` | `cfg.UsernameHandler.QuickAnalysis` | تخمین اولیه و سریع بدون کسر کریدیت |
| `GET` | `/api/v1/usernames/quick/stream` | `cfg.UsernameHandler.StreamQuickAnalysis` | استریم SSE جهت نمایش لحظه‌ای امتیازات موتورهای AVM |
| `GET` | `/api/v1/usernames/valuate` | `cfg.UsernameHandler.Valuate` | محاسبه دقیق ارزش نهایی همراه با تحلیل عمیق (نیاز به لاگین) |
| `GET` | `/api/v1/usernames/similar` | `cfg.UsernameHandler.GetSimilar` | دریافت یوزرنیم‌های مشابه و فروخته‌شده |
| `GET` | `/api/v1/usernames/rates` | `cfg.UsernameHandler.GetRates` | نرخ زنده تبدیل TON / USD / XTR برای محاسبات مالی |
| `GET` | `/api/v1/usernames/collection/stats` | `cfg.CollectionHandler.GetStats` | آمار حجمی و تاریخی بازار فرگمنت |
| `POST`| `/api/v1/usernames/valuation-pay-stars` | `cfg.UsernameHandler.ValuationPayStars` | پرداخت هزینه ارزیابی با Telegram Stars |
| `POST`| `/api/v1/usernames/valuation-pay-airdrop` | `cfg.UsernameHandler.ValuationPayAirdrop` | پرداخت با امتیازات درون‌برنامه‌ای |

---

## 📂 ۲. سورس‌کد بک‌اند (Backend Files)

- **هندلر اصلی:** [`backend/internal/handler/username_handler.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/handler/username_handler.go)
- **منطق بیزینس و سرویس:** [`backend/internal/service/username/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/username/)
  - کالیبراسیون و تجمیع: [`backend/internal/service/username/avm/valuation.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/username/avm/valuation.go)
  - اعتبارسنجی ورودی: [`backend/internal/service/username/validation.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/username/validation.go)
- **مدل‌های داده (Entity Structs):** [`backend/internal/model/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/model/)
- **ریپازیتوری دیتابیس:** [`backend/internal/repository/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/repository/)

---

## 🗄️ ۳. مایگریشن‌ها و جداول PostgreSQL

فایل‌های اسکریپت در [`backend/migrations/`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/):
1. [`000053_username_valuation.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000053_username_valuation.up.sql) — ایجاد ساختار پایه‌ای جداول ارزیابی یوزرنیم‌ها
2. [`000066_username_valuation_tables.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000066_username_valuation_tables.up.sql) — تعریف دقیق جداول فاکتورهای امتیازدهی و متادیتای فروش‌ها
3. [`000071_avm_v7_calibration.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000071_avm_v7_calibration.up.sql) — پارامترهای کالیبراسیون وزنی AVM v7
4. [`000096_username_collection_institutional.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000096_username_collection_institutional.up.sql) — شاخص‌های تحلیلی پورتفولیو و آمار دسته‌جمعی

---

## 💻 ۴. فرانت‌اند SolidJS (Frontend UI)

مسیر اصلی: [`frontend/src/pages/username/`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/)
- **صفحه نمایش و تحلیل:** مدیریت کارت قیمت، نمودار شباهت‌ها و پیشنهادات مشابه.
- **ارتباط با سرور:** فراخوانی سرویس‌های API از طریق پوشه `frontend/src/services/`.

---

## 🔗 اسناد مرتبط:
- [[00 - Overview & Business Rules]] — قوانین کسب‌وکار
- [[01 - Technical Architecture & AVM]] — فرمول‌ها و معماری
- [[03 - Agent Task Template - Usernames]] — دستور کار آماده برای ایجنت
