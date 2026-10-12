---
title: "داشبورد و پروموی سرمایه‌گذاران — Investors & Dashboard (InvestorsPromoPage)"
tags:
  - ifragment
  - frontend
  - dashboard
  - investors
  - promo
type: frontend-page
route: "/dashboard, /investors"
component: "frontend/src/pages/dashboard/dashboard/ui/InvestorsPromoPage.tsx"
status: production
---

# 💎 داشبورد و پروموی سرمایه‌گذاران — Investors & Dashboard (`InvestorsPromoPage`)

این سند مشخصات فنی، رفتاری و ساختاری صفحه داشبورد و کمپین‌های تبلیغاتی سرمایه‌گذاران (`InvestorsPromoPage`) را بر مبنای پیاده‌سازی سورس‌کد فرانت‌اند و APIهای بک‌اند تشریح می‌کند.

---

## 🧭 ۱. شناسنامه فنی صفحه (Technical Identity)
- **مسیرهای روت در برنامه:** `/dashboard` و `/investors`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/dashboard/dashboard/ui/InvestorsPromoPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/dashboard/dashboard/ui/InvestorsPromoPage.tsx)
- **کامپوننت کمکی داشبورد هاب:** [`frontend/src/pages/dashboard/dashboard/ui/DashboardPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/dashboard/dashboard/ui/DashboardPage.tsx)
- **موجودیت و API لایه کلاینت:** [`frontend/src/entities/investors/api/investorsApi.ts`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/entities/investors/api/investorsApi.ts)
- **ویجت‌های متصل:**
  - نوار ناوبری پایین: [`frontend/src/widgets/bottom-nav/BottomNav.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/widgets/bottom-nav/BottomNav.tsx)
- **وابستگی‌های SDK تلگرام:**
  - هندل دکمه بازگشت تاریخچه تلگرام (`useTelegramBackButton(-1)`)
  - هپتیک فیدبک سبک و متوسط (`haptic.impact('medium')`)
  - باز کردن مستقیم لینک سوپرگروه در کلاینت تلگرام (`openTelegramLink('https://t.me/FragmentInvestors')`)

---

## 🎯 ۲. کارکرد واقعی در کد و رفتار بصری (What This Page Does)
این صفحه به عنوان **ویترین انحصاری جذب سرمایه‌گذار و دعوت به گروه VIP سرمایه‌گذاران فرگمنت (Fragment Investors)** عمل می‌کند.

### جریان کاربر و حالت‌های صفحه (User Journey & States):
1. **لودینگ اسکلتی (Skeleton State):**
   - به محض ورود کاربر، انیمیشن نبض‌پالس تاریک (`animate-pulse`) با پس‌زمینه `#08090d` لود می‌شود تا مانع از پرش تصویر گردد.
2. **دریافت تصویر بنر پویا از سرور (Dynamic Banner Fetch):**
   - کوئری `['public', 'investors-page']` از طریق `investorsApi.getPageConfig` آدرس تصویر پروموشن فعلی را می‌خواند.
   - آدرس فایل از طریق هلپر `buildMediaUrl` به آدرس پروداکشن یا CDN سرور تبدیل می‌شود.
3. **کلیک روی تصویر و هدایت به تلگرام (Seamless Deep Linking):**
   - کل صفحه به صورت تمام‌صفحه قابل کلیک (`cursor-pointer`) است.
   - با کلیک، ابتدا هپتیک فیدبک گوشی فعال می‌شود و سپس کاربر مستقیماً به کانال/سوپرگروه رسمی `https://t.me/FragmentInvestors` منتقل می‌شود.
   - فال‌بک امن: چنانچه تلگرام مینی‌اپ در مرورگر معمولی وب باز شده باشد، متد `window.open` اجرا می‌شود.
4. **حالت خطا و دکمه تلاش مجدد (Error & Retry State):**
   - در صورت خطای شبکه یا عدم لود تصویر، استیت خطا با آیکون `error_outline` و پیام راهنما نمایش داده می‌شود.
   - دکمه `Retry` با متوقف کردن انتشار رویداد (`stopPropagation`) مجدداً کوئری را ری‌فچ و کش را پاکسازی می‌کند.
5. **حالت عدم وجود بنر (Empty State):**
   - در صورت خالی بودن مقدار `image_url` در دیتابیس، کارت استیت خالی با آیکون `image_not_supported` نمایش می‌یابد.

---

## ⚡ ۳. هوک‌ها، کش و تعاملات API
- **TanStack Solid Query:**
  - کلید کوئری: `['public', 'investors-page']`
  - مقدار `staleTime: 60_000` (۶۰ ثانیه کش محلی جهت جلوگیری از اسپم درخواست به بک‌اند)
- **متدهای API متصل:**
  - `investorsApi.getPageConfig()` — فراخوانی اندپوینت عمومی کانفیگ سرمایه‌گذاران
- **تست‌های واحد روت:**
  - [`frontend/src/pages/dashboard/dashboard/ui/InvestorsPromoPage.test.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/dashboard/dashboard/ui/InvestorsPromoPage.test.tsx)

---

## ⚠️ ۴. خطوط قرمز و الزامات ایجنت در این صفحه
1. **عدم هاردکد کردن آدرس عکس:** تصویر بنر به هیچ عنوان نباید استاتیک در سورس فرانت‌اند قرار گیرد؛ باید از کانفیگ بک‌اند خوانده شود.
2. **پشتیبانی تم تیره OLED:** پس‌زمینه اصلی رنگ `#08090d` و پالت تیره بدون پس‌زمینه‌های بنفش و خاکستری روشن غیرهمگون.
3. **عدم اختلال در دکمه بازگشت تلگرام:** دکمه Back تلگرام باید کاربر را دقیقاً به روت قبلی هدایت کند.

---

## 🔗 صفحات مرتبط
- [[01 - Home (IndexPage & ActionArea)|۰۱. صفحه اصلی]]
- [[13 - Group Leaderboard (LeaderboardPage)|۱۳. لیدربورد سوپرگروه Fragment Investors]]
- [[18 - Owner Admin Panel (OwnerPages)|۱۸. پنل مدیریت اونر]]
