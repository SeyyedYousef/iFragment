---
title: "تحلیل کلان کالکشن تل‌مینت و شاخص‌های بازار — Collection Analytics (CollectionInfoPage)"
tags:
  - ifragment
  - frontend
  - collection
  - telemint
  - market-pulse
  - fear-greed
  - institutional
type: frontend-page
route: "/collection-info"
component: "frontend/src/pages/collection-info/ui/CollectionInfoPage.tsx"
status: production
---

# 📊 تحلیل کلان کالکشن تل‌مینت و دیدبان بازار — Collection Analytics (`CollectionInfoPage`)

این سند مشخصات فنی، محاسباتی، نمودارها و نیازمندی‌های داشبورد تحلیل نهادی کالکشن یوزرنیم‌های تل‌مینت فرگمنت (`CollectionInfoPage`) را با استناد به سورس‌کد پروژه تبیین می‌کند.

---

## 🧭 ۱. شناسنامه فنی صفحه (Technical Identity)
- **مسیر روت در مینی‌اپ:** `/collection-info`
- **فایل کامپوننت صفحه:** [`frontend/src/pages/collection-info/ui/CollectionInfoPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/collection-info/ui/CollectionInfoPage.tsx)
- **کامپوننت نمودار پیشرفته:** [`frontend/src/pages/collection-info/ui/UsernameCollectionChart.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/collection-info/ui/UsernameCollectionChart.tsx)
- **قرارداد هوشمند مرجع (Master Telemint Contract):**
  - آدرس کانترکت در شبکه تون: `EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi`
- **وابستگی‌های SDK و روت:**
  - `useTelegramBackButton(-1)` جهت بازگشت به صفحه ارجاع‌دهنده
  - هپتیک فیدبک کپی قرارداد و تب‌ها (`haptic.notify('success')`, `haptic.selection()`)

---

## 🎯 ۲. قابلیت‌ها و ماژول‌های تحلیلی صفحه (What This Page Does)

این صفحه **داشبورد تحلیلی در سطح سرمایه‌گذاران نهادی (Institutional Analytics)** برای رصد سلامت و حجم کل اکوسیستم حراج‌های یوزرنیم فرگمنت است:

### الف. متادیتای کلکسیون و شاخص طمع و ترس (Fear & Greed Index):
- نمایش عنوان و آیکون رسمی کالکشن یوزرنیم‌های تلگرام با قابلیت کپی مستقیم آدرس کانترکت تل‌مینت.
- محاسبه و نمایش **شاخص طمع و ترس بازار (Fear & Greed Index)** با نشانگر رنگی (Extreme Fear تا Extreme Greed) برای سنجش سنتیمنت سرمایه‌گذاران.
- نرخ زنده تبدیل تون به دلار (`ton_usd_rate`) جهت نمایش دقیق معادل دلاری حجم معاملات.

### ب. نبض بازار (Market Pulse Signals):
ارزیابی ۴ سیگنال حیاتی بازار با مقادیر کمّی، تغییرات درصدی (`delta`) و وضعیت‌های سبز، زرد و قرمز:
1. **تقاضای بازار (Demand):** بررسی جریان پیشنهادهای قیمت جدید در حراجی‌ها.
2. **فشار عرضه (Supply Pressure):** رصد حجم توکن‌های واردشده برای فروش.
3. **نقدینگی (Liquidity):** سرعت گردش سرمایه و بسته شدن مزایده‌ها.
4. **ممنتوم قیمت (Price Momentum):** شتاب تغییرات میانگین ارزش معاملات.

### ج. نمودار بصری حجم و توزیع قیمت (`UsernameCollectionChart`):
- تحلیل بصری هیستوگرام قیمت‌ها و حجم روزانه با فیلترهای زمانی مختلف.
- امکان مشاهده دسته‌بندی موضوعی حجم‌ها (Shorts، Crypto، Brands، سایر).

### د. تالار افتخارات و برترین معاملات تاریخ (Top Sales Leaderboard):
- تب اختصاصی `leaderboard` که رکوردهای تاریخی فروش را نمایش می‌دهد.
- فیلتر هوشمند دسته‌ها:
  - `short`: یوزرنیم‌های ۴ حرفی و کمتر (مانند `@news`, `@auto`)
  - `crypto`: نام‌های مرتبط با ارزهای دیجیتال (`@ton`, `@btc`, `@eth`)
  - `brand`: برندهای تجاری مطرح
- نمایش قیمت معامله به TON و USD همراه با تیک تأیید اصالت معامله بر بستر TON Blockchain (`tx_hash`).

---

## ⚡ ۳. هوک‌ها، کش و تعاملات API
- **TanStack Query:**
  - کلید کوئری: `['usernameCollectionStats']`
  - اندپوینت بک‌اند: `GET /api/v1/usernames/collection/stats`
  - کش موقت: ۵ دقیقه (`staleTime: 5 * 60 * 1000`)
- **مدیریت استیت:**
  - تب‌های فعال: `activeTab` بین `'overview'` و `'leaderboard'`
  - فیلتر لیدربورد: `leaderboardFilter` بین `'all'`, `'short'`, `'crypto'`, `'brand'`

---

## ⚠️ ۴. خطوط قرمز و الزامات توسعه‌دهندگان
1. **صحت آدرس قرارداد تل‌مینت:** آدرس قرارداد اصلی تل‌مینت `EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi` یک مقدار حیاتی و تغییرناپذیر است و نباید تغییر داده شود.
2. **پشتیبانی از ارقام دلاری:** تمام مبالغ TON در این صفحه باید با ضرب در `tonUsdRate` معادل دلاری قابل فهم داشته باشند.
3. **ریسپانسیو بودن نمودارها:** کامپوننت `UsernameCollectionChart` باید در ویوپورت‌های باریک موبایل بدون اسکرول افقی مزاحم رندر شود.

---

## 🔗 صفحات مرتبط
- [[01 - Home (IndexPage & ActionArea)|۰۱. صفحه اصلی]]
- [[03 - Username Valuation (UsernamePage)|۰۳. ارزش‌گذاری هوشمند یوزرنیم‌ها]]
- [[04 - Fragment Domain & Smart Contracts|۰۴. معماری قراردادهای هوشمند تل‌مینت]]
