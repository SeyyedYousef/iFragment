---
title: "🎁 صفحه گزارش ارزش‌گذاری گیفت — Gift Report (`GiftReportPage`)"
tags:
  - frontend
  - gifts
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🎁 صفحه گزارش ارزش‌گذاری گیفت — Gift Report (`GiftReportPage`)

این سند مشخصات فنی و تجربه کاربری کارت سه‌بعدی و **گزارش ارزش‌گذاری گیفت‌های تلگرام** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/gifts/report` و `/gifts/valuation`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/gifts/report/ui/GiftReportPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/report/ui/GiftReportPage.tsx)
- **کارت‌ها و ویجت‌های درون گزارش:**
  - کارت ژیروسکوپ سه‌بعدی تعاملی (3D Gyro Card)
  - برنامه‌ریزی خروج و فروش: `GiftExitPlannerCard.tsx`
  - کارت استراتژی لایا: `GiftLayaActionCard.tsx`
  - برابری و نقدشوندگی استارز: `GiftStarsParityCard.tsx`
  - سینرژی و هم‌پوشانی ویژگی‌ها: `GiftTraitSynergyCard.tsx`
  - ستون‌های محاسباتی ارزش‌گذاری: `GiftValuationPillarsCard.tsx`
  - درگاه پرداخت و کسر کریدیت: `UnifiedPaywallGate`

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

### ۱. کارت تعاملی سه‌بعدی ژیروسکوپی (3D Gyro Tilt Card):
- شبیه‌سازی فیزیکی افکت چرخش کارت متناسب با حرکت ماوس روی دسکتاپ یا ژیروسکوپ گوشی موبایل (`tilt` state).
- انعکاس نور پویا (Gloss Effect) روی لبه‌های کارت شیشه‌ای گیفت.

### ۲. درگاه کنجکاوی و پی‌وال (Curiosity Gate):
- استعلام وضعیت قفل گزارش با `giftsApi.getCuriosityGate(giftID)`.
- تا قبل از کسر کریدیت، ارزش پولی محرمانه می‌ماند و تنها تعداد شاخص‌های اطمینان، برچسب‌های نایابی و سیگنال‌های مثبت نمایش می‌یابد (قانون Zero Price Leakage).

### ۳. گزارش غنی‌شده پس از آنلاک (`GiftValuationReport` & `EnrichedReport`):
- **ستون‌های ارزش‌گذاری (`GiftValuationPillarsCard`):** نمایش قیمت عادلانه در دو واحد TON و USD با تضمین Hard Anchor Invariant.
- **هم‌پوشانی صفات (`GiftTraitSynergyCard`):** نایابی تلفیقی ۴ ویژگی (مدل، پترن، پالت رنگ، شماره صدور).
- **برابری استارز (`GiftStarsParityCard`):** ارزش بازخرید با Telegram Stars در مقایسه با بازار ثانویه TON.
- **برنامه‌ریزی فروش (`GiftExitPlannerCard`):** تخمین زمان نقدشوندگی و قیمت پیشنهادی برای فروش سریع یا سود حداکثری.

### ۴. اقدامات وایرال:
- دکمه اشتراک‌گذاری مستقیم در استوری تلگرام (`shareToStory`).
- کپی پیوند گواهی اصالت در کلیپ‌بورد.
- دکمه باز کردن مستقیم دارایی در تلگرام (`openTelegramLink('https://t.me/nft/...')`).

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `giftsApi.getCuriosityGate(giftID)` — کوئری وضعیت گیت کنجکاوی
- `giftsApi.valuate(giftID)` — کوئری ارزش‌گذاری مدل GV-Engine
- `giftsApi.getEnrichedReport(giftID)` — دریافت متادیتای آنچین و تبارشناسی
- `giftsApi.unlockWithCredit(giftID)` — میوتیشن کسر کریدیت

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] اثر ژیروسکوپ نباید در موبایل باعث لگ یا لرزش رابط کاربری شود (`handleMouseMove` و `handleMouseLeave`).
- [ ] در صورت موجود نبودن گیفت، مقدار دیفالت `plush_pepe-42` به عنوان فال‌بک استفاده می‌شود.
