---
title: "🗺️ Anonymous Numbers — Code & API Map"
tags:
  - domain
  - ifragment
  - numbers
  - nvengine
type: vertical-domain
status: production
---

# 🗺️ Anonymous Numbers — Code & API Map

نقشه جامع مسیر فایل‌های سورس‌کد، روت‌های API، جداول دیتابیس و صفحات فرانت‌اند **شماره‌های ناشناس تلگرام (+888)**.

---

## 🌐 ۱. روت‌های شبکه و API Backend

تعریف شده در: [`backend/internal/router/router.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/router/router.go#L118-L140)

| متد | مسیر روت | هندلر مربوطه | هدف و توضیحات |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/numbers/list` | `cfg.NumbersHandler.GetNumbersList` | لیست فیلترشده شماره‌ها همراه با قیمت و کف بازار |
| `GET` | `/api/v1/numbers/intel` | `cfg.NumbersHandler.GetIntel` | شاخص‌های کلان تحلیلی، حجم معاملات و توزیع هولدرها |
| `GET` | `/api/v1/numbers/collection-overview` | `cfg.NumbersHandler.GetCollectionOverview` | نمای کلی ۱۳۶,۵۶۶ شماره بر اساس دسته‌بندی کلوپ‌ها |
| `GET` | `/api/v1/numbers/patterns` | `cfg.NumbersHandler.GetPatternAnalytics` | آمار فراوانی الگوهای رندی (پلکانی، آینه‌ای، دوبل) |
| `GET` | `/api/v1/numbers/colors` | `cfg.NumbersHandler.GetColors` | توزیع و پرمیوم قیمتی ۲۰ رنگ کارت NFT تلگرام |
| `GET` | `/api/v1/numbers/mask` | `cfg.NumbersHandler.SearchMask` | موتور جستجوی ماسک کاراکتری (مانند `*888*` یا `XXXYYY`) |
| `GET` | `/api/v1/numbers/deals` | `cfg.NumbersHandler.GetDeals` | رادار کشف شماره‌های زیر قیمت منصفانه (Arbitrage / Deals) |
| `GET` | `/api/v1/numbers/clubs` | `cfg.NumbersHandler.GetClubs` | لیست کلوپ‌های خاص (۴ رقمی جنسیس، ۵ رقمی و غیره) |
| `GET` | `/api/v1/numbers/portfolio` | `cfg.NumbersHandler.ScanPortfolio` | اسکن پورتفولیوی شماره‌های یک کیف‌پول با ریت‌لیمیت |
| `GET` | `/api/v1/numbers/activity` | `cfg.NumbersHandler.GetLiveActivity` | فید زنده آخرین فروش‌ها و بیدهای مزایده‌های فرگمنت |
| `GET` | `/api/v1/numbers/valuate` | `cfg.NumbersHandler.Valuate` | محاسبه ارزش دقیق شماره توسط موتور NV Engine |
| `GET` | `/api/v1/numbers/gate` | `cfg.NumbersHandler.GetCuriosityGate` | درگاه کنجکاوی و تیزر قبل از کسر کریدیت |
| `POST`| `/api/v1/numbers/unlock-credit` | `cfg.NumbersHandler.UnlockWithCredit` | باز کردن قفل گزارش کامل با Intel Credit |

---

## 📂 ۲. سورس‌کد بک‌اند (Backend Files)

- **هندلر اصلی:** [`backend/internal/handler/numbers_handler.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/handler/numbers_handler.go)
- **سرویس اصلی:** [`backend/internal/service/numbers/numbers_service.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/numbers/numbers_service.go)
- **موتور ریاضی NV Engine:** [`backend/internal/service/numbers/nvengine/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/numbers/nvengine/)
- **استخراج ۲۷ سیگنال ویژگی:** [`backend/internal/service/numbers/features/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/numbers/features/)
- **اینکسر و رجیستری:** [`backend/internal/service/numbers/indexer/`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/service/numbers/indexer/) و `registry/`
- **ریپازیتوری دیتابیس:** [`backend/internal/repository/numbers_repo.go`](file:///c:/Users/DEll/Desktop/iFragment/backend/internal/repository/numbers_repo.go)
- **دایره‌المعارف جامع در مستندات پروژه:** [`docs/telegram_anonymous_numbers_encyclopedia.md`](file:///c:/Users/DEll/Desktop/iFragment/docs/telegram_anonymous_numbers_encyclopedia.md)

---

## 🗄️ ۳. مایگریشن‌ها و جداول PostgreSQL

فایل‌های اسکریپت در [`backend/migrations/`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/):
1. [`000070_anonymous_numbers_vertical.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000070_anonymous_numbers_vertical.up.sql) — زیرساخت اولیه شماره‌های ناشناس، کلکسیون بسته و صفات
2. [`000078_fix_number_sales_idempotency.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000078_fix_number_sales_idempotency.up.sql) — رفع مشکل همپوشانی و تثبیت ایندکس‌های فروش
3. [`000097_number_collection_institutional.up.sql`](file:///c:/Users/DEll/Desktop/iFragment/backend/migrations/000097_number_collection_institutional.up.sql) — جداول ماکرو برای کلوپ‌ها و تحلیل نهادی پورتفولیو

---

## 💻 ۴. فرانت‌اند SolidJS (Frontend UI)

پوشه کامپوننت‌ها و صفحات: [`frontend/src/pages/numbers/`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/numbers/)
- **کاوشگر شماره‌ها و کلوپ‌ها:** فیلتر بر اساس طول رقم، قیمت، الگوها و جستجوی ماسک.
- **کارت شماره و گزارش ارزش‌گذاری:** نمایشگر ارگونومی کیپد و تفکیک ارزش بر اساس ۲۷ سیگنال.

---

## 🔗 اسناد مرتبط:
- [[00 - Overview & Business Rules]] — تاریخچه و قوانین بازار
- [[01 - Technical Architecture & NVEngine]] — معماری موتور و ۲۷ سیگنال
- [[03 - Agent Task Template - Numbers]] — قالب تسک‌دهی به ایجنت
