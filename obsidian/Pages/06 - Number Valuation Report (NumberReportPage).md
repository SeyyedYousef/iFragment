---
title: "🔢 صفحه گزارش ارزش‌گذاری شماره — Number Report (`NumberReportPage`)"
tags:
  - frontend
  - ifragment
  - numbers
  - page
  - ui
type: frontend-page
status: production
---

# 🔢 صفحه گزارش ارزش‌گذاری شماره — Number Report (`NumberReportPage`)

این سند مشخصات فنی و تجربه کاربری صفحه **گزارش تخصصی ارزش‌گذاری و گواهی دیجیتال شماره‌های ناشناس (+888)** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/numbers/report` و `/numbers/valuation`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/numbers/report/ui/NumberReportPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/numbers/report/ui/NumberReportPage.tsx)
- **کارت‌ها و ویجت‌های اختصاصی:**
  1. گواهی دیجیتال اصالت و تلمینت: `NumberDigitalCertificateCard.tsx`
  2. کارت مهندسی مالی و ارزیابی اقتصادی: `NumberFinancialEngineeringCard.tsx`
  3. رادار فرهنگی شماره: `NumberSingleCulturalRadarCard.tsx`
  4. درگاه پرداخت و کسر کریدیت: `UnifiedPaywallGate` و `CreditStoreSheet`

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

### ۱. اعتبارسنجی ورودی (`validateAndFormatAnonymousNumber`):
- تبدیل ارقام فارسی و عربی به اسکی (`toAsciiDigits`).
- اعتبارسنجی پیشوند `+888`.
- تشخیص طول مجاز شماره: **فقط ۴ رقم (Genesis) یا ۸ رقم (Standard)**.
- تعیین رده نایابی ذاتی:
  - `GRAIL` (کلوپ جنسیس ۴ رقمی و رندهای تک‌رقمی)
  - `APEX` (رندهای آینه‌ای و دوبل درجه یک)
  - `GRAND` (الگوهای منظم ۵ تا ۷ رقمی)
  - `STANDARD` (شماره‌های عمومی ۸ رقمی)

### ۲. درگاه کنجکاوی (Curiosity Gate & Paywall):
- اگر کاربر این شماره را آنلاک نکرده باشد، قیمت مخفی می‌ماند و تنها فاکتورهای تیزر (`CuriosityGateData`) نمایش داده می‌شوند:
  - تعداد سیگنال‌های مثبت الگوریتم
  - تعداد شاخص‌های ریسک
  - وضعیت فروش در مارکت
- باز کردن قفل با کریدیت (`creditsApi`) یا با پرداخت تلگرام استارز/تون.

### ۳. کارت‌های تحلیلی گزارش بازشده:
- **`NumberDigitalCertificateCard`:** کارت لوکس شیشه‌ای با متادیتای بلاکچین TON، آدرس اسمارت کانترکت Telemint و تاریخچه ثبت.
- **`NumberFinancialEngineeringCard`:** برآورد قیمت بر حسب TON و USD، بازدهی تخمینی اجاره (Rental Yield) و سقف وثیقه‌گذاری دیفای.
- **`NumberSingleCulturalRadarCard`:** دیاگرام راداری شانس، سهولت ارگونومی کیپد و وزن فرهنگی.

---

## ⚡ ۳. هوک‌ها و فراخوانی‌های بک‌اند
- `numbersApi.getCuriosityGate(number)` — دریافت تیزر قبل از پرداخت
- `numbersApi.valuate(number)` — محاسبه ارزش نهایی توسط موتور NV Engine
- `numbersApi.unlockWithCredit(number)` — کسر کریدیت و آنلاک گزارش ۲۴ ساعته

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] به هیچ وجه نباید شماره‌های با طول غیرمجاز (مثلاً ۳ یا ۵ یا ۹ رقمی) وارد ارزیابی شوند؛ خطای اعتبارسنجی در جا نمایش داده شود.
- [ ] استیت کپی شدن گواهی در کلیپ‌بورد با فیدبک هپتیک تلگرام همراه باشد.
