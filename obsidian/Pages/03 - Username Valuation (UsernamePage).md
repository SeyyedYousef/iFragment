---
title: "🏷️ صفحه ارزش‌گذاری یوزرنیم — Username Page (`UsernamePage`)"
tags:
  - frontend
  - ifragment
  - page
  - ui
  - usernames
type: frontend-page
status: production
---

# 🏷️ صفحه ارزش‌گذاری یوزرنیم — Username Page (`UsernamePage`)

این سند مشخصات فنی و رفتاری صفحه اصلی تحلیل و ارزش‌گذاری یوزرنیم‌ها بر اساس کد واقعی پیاده‌سازی‌شده است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/username` و `/username/report` و `/username/valuation`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/username/ui/index.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/ui/index.tsx)
- **کامپوننت‌های فرعی و کارت‌ها:**
  - کاوشگر دسته‌بندی‌های لایا: [`LayaCategoriesExplorer.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/ui/components/LayaCategoriesExplorer.tsx)
  - کارت چندبعدی ارزیابی: [`LayaMultiDimensionalCard.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/ui/components/LayaMultiDimensionalCard.tsx)
  - کارت پرسونای خریدار هدف: [`TargetBuyerPersonaCard.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/ui/components/TargetBuyerPersonaCard.tsx)
  - ماتریس حقوقی قوانین تلگرام: [`TelegramTOSLegalMatrix.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/username/ui/components/TelegramTOSLegalMatrix.tsx)
  - درگاه پرداخت و کسر کریدیت: [`UnifiedPaywallGate`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/widgets/paywall/)

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی (Real Code Logic)

### ۱. پردازش پارامتر ورودی:
- خواندن یوزرنیم از کوئری‌پارامتر `?u=...` یا فیلد جستجوی صفحه.
- بررسی کش محلی گزارش‌های ۲۴ ساعته (`getCachedReport`) برای جلوگیری از کسر مجدد کریدیت کاربر.

### ۲. ساختار خروجی ارزیابی (`ValuationResult`):
- **دامنه ارزش‌گذاری TON و USD:** نمایش قیمت پایه (`base_price_ton`)، حداقل (`low_ton`)، قیمت انتظاری (`expected_ton`) و سقف ارزش (`high_ton`).
- **شاخص اطمینان (Confidence Score):** درصد دقت مدل بر اساس معاملات مشابه تاریخی (`comparable_sales_count`).
- **کارت نایابی (Rarity & Tier):** ستاره‌ها و رده‌بندی کیفی نام.
- **اطلاعات لغت‌نامه و زبان‌شناسی (Dictionary):** تشخیص کلمه انگلیسی، بخش گفتار (اسم/فعل/صفت) و تعریف لغوی.
- **تاریخچه معاملات Fragment (History):** استعلام وضعیت فروش قبلی، آدرس مالک و آخرین قیمت محقق‌شده.
- **یوزرنیم‌های مشابه (Similar Sales):** مقایسه با نام‌های مشابه فروخته‌شده در مارکت.
- **پروفایل مالک (Owner Profile):** آواتار تلگرام، نام، وضعیت پرمیوم و نوع حساب کاربری در صورت عمومی بودن.
- **تحلیل SEO و لیکوییدیتی:** امتیاز بهینه‌سازی موتورهای جستجو (`seo.score`)، رتبه نقدشوندگی (`liquidity_rating`) و زمان تخمینی نقد شدن (`estimated_sell_time`).
- **رشد پیش‌بینی‌شده (Projected Growth):** تارگت صعودی و نزولی در بازار گاوی (`bull_ton`).

### ۳. قابلیت‌های وایرال و اشتراک‌گذاری:
- **اکسپورت عکس کارت:** تبدیل کارت ارزیابی به تصویر PNG شفاف با `toPng` (پکیج `html-to-image`).
- **اشتراک‌گذاری در استوری تلگرام:** قابلیت مستقیم `shareToStory` برای جذب کاربران جدید به بات.

---

## ⚡ ۳. هوک‌ها و فراخوانی‌های بک‌اند
- `valuationApi.getValuation(username)` — دریافت دیتای محاسبه‌شده AVM
- `creditsApi.consumeCredit(...)` — کسر کریدیت در صورت قفل بودن گزارش
- `saveReport(username, data)` — کش کردن نتایج در حافظه کلاینت

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] درگاه `UnifiedPaywallGate` باید قبل از نمایش دیتای عمیق اطمینان حاصل کند که کریدیت پرداخت شده است.
- [ ] اکسپورت استوری تلگرام در نسخه دسکتاپ کرش نکند و در صورت عدم پشتیبانی، کپی لینک را پیشنهاد دهد.
