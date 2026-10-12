---
title: "🎁 صفحه دیدبان کلان گیفت‌ها — Gifts Intel (`GiftsIntelPage`)"
tags:
  - frontend
  - gifts
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🎁 صفحه دیدبان کلان گیفت‌ها — Gifts Intel (`GiftsIntelPage`)

این سند مشخصات فنی و تجربه کاربری صفحه **دیدبان بازار ماکروی گیفت‌های تلگرام (Gifts Intel)** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/gifts` و `/gifts/intel`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/gifts/intel/ui/GiftsIntelPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/intel/ui/GiftsIntelPage.tsx)
- **ویجت اصلی درون صفحه:** `GiftsChartView.tsx`
- **سطح دسترسی:** عمومی

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

### ۱. هدر و شاخص‌های کلان بازار:
- **ارزش کل بازار اکوسیستم (Total Market Cap):** نمایش تخمین دلاری کل گیفت‌های مینت‌شده (`total_market_cap_usd` به میلیون دلار).
- **تعداد کل گیفت‌های کاتالوگ:** تعداد اقلام ثبت‌شده در رجیستری آنچین (`total_gifts_minted`).

### ۲. ویجت تحلیل و نمودار (`GiftsChartView`):
- نمایش چارت حجم و تغییرات قیمت بر پایه دیتای `intelQuery`.
- مقایسه پویای ترندهای رشد کالکشن‌ها در بازار ثانویه تلگرام و مارکت‌پلیس‌های TON.

### ۳. ارجاع به داده‌های آنچین و تغییرات لحظه‌ای:
- نشان تایید رسمی داده‌ها با اتصال به فید `api.changes.tg` و کانال تخصصی `@GiftChanges`.

---

## ⚡ ۳. هوک‌ها و فراخوانی‌های بک‌اند
- `giftsApi.getIntel()` — اطلاعات کلان اکوسیستم گیفت‌ها (Stale Time: ۴۵ ثانیه)

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] هدر صفحه نباید در زمان لودینگ اولیه دچار لرزش ابعاد شود.
- [ ] دکمه بازگشت با `useTelegramBackButton(-1)` مدیریت شود.
