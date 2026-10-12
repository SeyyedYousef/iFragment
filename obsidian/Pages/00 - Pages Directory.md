---
title: "📑 راهنمای جامع صفحات وب‌اپلیکیشن iFragment (Pages Directory)"
tags:
  - frontend
  - ifragment
  - page
  - ui
type: index-hub
status: production
---

# 📑 راهنمای جامع صفحات وب‌اپلیکیشن iFragment (Pages Directory)

این پوشه حاوی مشخصات دقیق، فنی و رفتاری **تمام ۱۸ صفحه فرانت‌اند تلگرام مینی‌اپ iFragment** بر اساس سورس‌کد واقعی و روت‌های تعریف‌شده در [`frontend/src/app/router/routes.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/app/router/routes.tsx) است. هر ایجنتی قبل از دست زدن به هر کامپوننت فرانت‌اند یا روت کاربری، ملزم است سند مربوطه را در این پوشه مطالعه کند.

---

## 🧭 لیست کامل صفحات به تفکیک روت و کامپوننت:

### ۱. پیشخوان، هاب ورودی و سرمایه‌گذاران:
- [[01 - Home (IndexPage & ActionArea)|۰۱. صفحه اصلی و لانچر ورودی (IndexPage & ActionArea)]] — مسیر `/`
- [[02 - Investors & Dashboard (InvestorsPromoPage)|۰۲. پروموی سرمایه‌گذاران و دعوت به سوپرگروه (InvestorsPromoPage)]] — مسیرهای `/dashboard` و `/investors`

### ۲. دامنه‌ی یوزرنیم‌ها و کالکشن نهادی:
- [[03 - Username Valuation (UsernamePage)|۰۳. کاوشگر، ارزش‌گذاری AVM و ماتریس لایا (UsernamePage)]] — مسیرهای `/username` و `/username/report`
- [[17 - Collection Analytics (CollectionInfoPage)|۱۷. تحلیل کلان کالکشن تل‌مینت، شاخص طمع/ترس و پالس بازار (CollectionInfoPage)]] — مسیر `/collection-info`

### ۳. دامنه‌ی شماره‌های ناشناس (+888):
- [[04 - Numbers Intel (NumbersIntelPage)|۰۴. دیدبان کلان بازار شماره‌ها (NumbersIntelPage)]] — مسیرهای `/numbers` و `/numbers/intel`
- [[05 - Numbers Collection (NumbersCollectionPage)|۰۵. کاوشگر کالکشن و کلوپ‌های رند (NumbersCollectionPage)]] — مسیر `/numbers/collection`
- [[06 - Number Valuation Report (NumberReportPage)|۰۶. کارت گزارش ارزش‌گذاری و گواهی دیجیتال (NumberReportPage)]] — مسیر `/numbers/report`
- [[07 - Numbers Mask Builder (MaskBuilderPage)|۰۷. ابزار ماسک‌ساز و جستجوی الگوها (MaskBuilderPage)]] — مسیر `/numbers/mask`

### ۴. دامنه‌ی گیفت‌های تلگرام (TEP-62):
- [[08 - Gifts Intel (GiftsIntelPage)|۰۸. دیدبان کلان بازار گیفت‌ها (GiftsIntelPage)]] — مسیرهای `/gifts` و `/gifts/intel`
- [[09 - Gift Collection (GiftCollectionPage)|۰۹. تحلیل عمیق کالکشن و هیت‌مپ نایابی (GiftCollectionPage)]] — مسیر `/gifts/collection`
- [[10 - Gift Valuation Report (GiftReportPage)|۱۰. کارت سه‌بعدی و گزارش ۱۰ بخشی ارزش‌گذاری (GiftReportPage)]] — مسیر `/gifts/report`
- [[11 - Gift Crafting Calculator (CraftingCalculatorPage)|۱۱. ماشین‌حساب شبیه‌ساز کرفتینگ مونت‌کارلو (CraftingCalculatorPage)]] — مسیر `/gifts/crafting`
- [[12 - Gift Portfolio Scanner (PortfolioScannerPage)|۱۲. اسکنر موجودی والت و استخراج CSV (PortfolioScannerPage)]] — مسیر `/gifts/portfolio`

### ۵. گیمیفیکیشن، رقابت‌ها و پروفایل کاربری:
- [[13 - Group Leaderboard (LeaderboardPage)|۱۳. لیدربورد سوپرگروه Fragment Investors و بوست‌ها (LeaderboardPage)]] — مسیرهای `/leaderboard` و `/profile/leaderboard`
- [[14 - Profile (ProfilePage)|۱۴. پروفایل کاربری، گالری دارایی‌ها و اطلاعات اشتراک (ProfilePage)]] — مسیر `/profile`
- [[15 - Profile Achievements (AchievementsPage)|۱۵. دستاوردها و نشان‌های افتخار (AchievementsPage)]] — مسیر `/profile/achievements`
- [[16 - Settings & Security (SettingsAndSecurityPages)|۱۶. تنظیمات شخصی‌سازی، سشن‌ها، بیومتریک و امنیت GDPR (Settings & Security)]] — مسیرهای `/profile/settings` و `/profile/security`

### ۶. پنل مدیریت ارشد اونر (Owner Suite):
- [[18 - Owner Admin Panel (OwnerPages)|۱۸. پنل مدیریت، امنیت TOTP، مانیتورینگ، مالی و جعل هویت (/owner/*)]] — روت‌های اختصاصی `/owner/*`

---

*بازگشت به خانه:* [[00 - Home|مرکز فرماندهی iFragment]]
