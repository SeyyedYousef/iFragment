---
title: "🔢 صفحه کاوشگر کالکشن شماره‌ها — Numbers Collection (`NumbersCollectionPage`)"
tags:
  - frontend
  - ifragment
  - numbers
  - page
  - ui
type: frontend-page
status: production
---

# 🔢 صفحه کاوشگر کالکشن شماره‌ها — Numbers Collection (`NumbersCollectionPage`)

این سند مشخصات فنی و اجزای پیشرفته صفحه **کالکشن جامع شماره‌های ناشناس تلگرام** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/numbers/collection`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/numbers/collection/ui/NumbersCollectionPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/numbers/collection/ui/NumbersCollectionPage.tsx)
- **۶ تب تخصصی صفحه (`CollectionTabKey`):**
  1. `overview` (نمای کلی و کلوپ‌ها)
  2. `market` (لیستینگ‌ها و ونسیوها)
  3. `patterns` (تحلیل الگوهای رندی)
  4. `holders` (توزیع هولدرها و نهنگ‌ها)
  5. `activity` (نوار زنده معاملات)
  6. `risk` (متدولوژی ریسک و ارزش‌گذاری)

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و اجزای ویجتی

### ۱. هدر و مدال‌های اختصاصی (`NumberCollectionHeader`):
- دکمه هدایت به سازنده ماسک (`onNavigateMask` -> `/numbers/mask`)
- **مدال اکسپورت (`NumberExportModal`):** دانلود خروجی اسنپ‌شات کالکشن
- **مدال هشدارها (`NumberAlertsModal`):** تنظیم آلرت تلگرامی برای کف قیمت کلوپ‌ها
- **مدال متدولوژی (`NumberRiskMethodology`):** تشریح فرمول‌های ریاضی و ریسک

### ۲. محتوای تب Overview:
- **`NumberCollectionKpis`:** نمایش کل عرضه (۱۳۶,۵۶۶ منجمد)، حجم تاریخی و هولدرهای یکتا.
- **`NumberClubFloorsTracker`:** پایشگر زنده کف قیمت کلوپ‌های نایابی:
  - کلوپ جنسیس ۴ رقمی
  - کلوپ ۵ رقمی
  - کلوپ‌های رپیتر و متقارن
- **`NumberDialpadErgonomics`:** محاسبه سهولت تایپ شماره روی صفحه کلید ۳×۴ تلفن.
- **`NumberCulturalRadarHeatmap`:** هیت‌مپ ارزش فرهنگی ارقام در فرهنگ‌های شرق آسیا، عربی و غربی.
- **`NumberDeFiFinancials`:** محاسبات مالی دیفای، پتانسیل وام‌دهی و اجاره شماره.

### ۳. سایر تب‌ها:
- `market`: فیلتر لیستینگ‌ها بر اساس ونسیو (`marketVenue`)، نوع فروش (`marketType`) و صفحه‌بندی.
- `patterns`: درصد نایابی الگوها (پلکانی، آینه‌ای، باینری) از `numbersApi.getPatternAnalytics()`.
- `holders`: ردیابی نهنگ‌ها و توزیع مالکیت در بلاکچین TON.
- `activity`: نوار لحظه‌ای آخرین فروش‌ها با زمان‌سنج زنده.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `numbersApi.getCollectionOverview()` — شاخص‌های کلیدی و نرخ TON/USD
- `numbersApi.getCollectionHistory(timeframe)` — سری‌های زمانی ۲۴ ساعته تا کل تاریخ
- `numbersApi.getCollectionListings(...)` — لیستینگ‌های صفحه‌بندی شده بازار
- `numbersApi.getPatternAnalytics()` — آنالیز فراوانی الگوها

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] سوییچ بین ۶ تب بدون تأخیر و با انیمیشن روان انجام شود.
- [ ] در تب Market، با تغییر ونسیو یا فیلتر، شماره صفحه (`marketPage`) باید ریست شده و به ۱ بازگردد.
