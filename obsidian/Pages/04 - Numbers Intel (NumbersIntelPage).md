---
title: "🔢 صفحه دیدبان شماره‌ها — Numbers Intel (`NumbersIntelPage`)"
tags:
  - frontend
  - ifragment
  - numbers
  - page
  - ui
type: frontend-page
status: production
---

# 🔢 صفحه دیدبان شماره‌ها — Numbers Intel (`NumbersIntelPage`)

این سند مشخصات فنی و تجربه کاربری صفحه **تحلیل و دیدبان کلان شماره‌های ناشناس تلگرام (+888)** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/numbers` و `/numbers/intel`
- **فایل کامپوننت روت:** [`frontend/src/pages/numbers/intel/ui/NumbersIntelPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/numbers/intel/ui/NumbersIntelPage.tsx)
- **ویجت‌های سه‌گانه درون صفحه:**
  1. نمودار تعاملی قیمت و ترندها: `NumbersChartView.tsx`
  2. جدول داده‌ای و فیلتر شماره‌ها: `NumbersTableView.tsx`
  3. اسکنر پورتفولیوی والت مالک: `NumbersPortfolioView.tsx`

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

این صفحه دارای یک ناوبری تب‌دار سه‌گانه (`activeTab`) است:

### ۱. تب نمودار (`chart`):
- **کف قیمت زنده (Live Floor Price):** محاسبه کف قیمت زنده بر اساس آخرین داده چارت و اینتل در TON و USD (`liveFloor`).
- **نمودار تاریخی حجم و قیمت:** رندر سری زمانی تغییرات قیمت با قابلیت زوم و تغییر بازه زمانی از `numbersApi.getChartData()`.
- **دکمه‌های فیلتر سریع (Quick Filters):** دکمه‌های مستقیم برای پرش به شماره‌های در مزایده (`auction`)، شماره‌های برای فروش فوری (`for_sale`) یا وضعیت مسدودی (`banned`).

### ۲. تب جدول شماره‌ها (`numbers`):
- نمایش لیست شماره‌ها با فیلترهای ترکیبی وضعیت فروش:
  - `saleType`: `auction` | `for_sale` | `not_for_sale`
  - `numberType`: `banned` | `not_banned`
- قابلیت کلیک روی هر شماره برای انتقال به صفحه گزارش اختصاصی (`/numbers/report?n=...`).

### ۳. تب پورتفولیو (`portfolio`):
- اگر پارامتر `?address=...` در URL باشد، خودکار روی این تب سوییچ می‌شود.
- بررسی لیست شماره‌های تحت تملک یک والت مشخص در شبکه TON همراه با ارزش کل پورتفولیو.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `numbersApi.getIntel()` — اطلاعات کلی بازار، کف قیمت و حجم معاملات
- `numbersApi.getChartData()` — داده‌های نمودار تاریخی قیمت
- `numbersApi.getNumbersList(...)` — واکشی لیست شماره‌ها با فیلترهای استیت

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] در صورت کلیک روی آدرس والت در جدول، باید با هپتیک فیدبک تب `portfolio` همان آدرس را لود کند.
- [ ] در صورتی که دیتای چارت کش شده بود، مقدار نرخ برابری ارز (`rate`) با نرخ لحظه‌ای هماهنگ بماند.
