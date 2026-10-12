---
title: "🏠 صفحه اصلی و لانچر ورودی — Home (`IndexPage` & `ActionArea`)"
tags:
  - frontend
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🏠 صفحه اصلی و لانچر ورودی — Home (`IndexPage` & `ActionArea`)

این سند مشخصات دقیق سورس‌کد و نیازمندی‌های صفحه اصلی مینی‌اپ بر اساس پیاده‌سازی واقعی کدهای فرانت‌اند است.

---

## 🧭 ۱. شناسنامه فنی صفحه (Technical Identity)
- **مسیر روت در برنامه:** `/`
- **فایل کامپوننت روت:** [`frontend/src/pages/home/home/ui/IndexPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/home/home/ui/IndexPage.tsx)
- **ویجت‌های متصل:**
  - هدر تب‌ها و بنر تبلیغاتی: [`frontend/src/widgets/hero-tabs/HeroTabs.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/widgets/hero-tabs/HeroTabs.tsx)
  - شیت کشویی اکشن: [`frontend/src/widgets/action-area/ActionArea.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/widgets/action-area/ActionArea.tsx)
  - منوی ناوبری پایین: [`frontend/src/widgets/bottom-nav/BottomNav.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/widgets/bottom-nav/BottomNav.tsx)
- **وابستگی‌های SDK تلگرام:**
  - پنهان‌سازی دکمه بازگشت (`backButton.hide()`)
  - گسترش تمام‌صفحه ویوپورت تلگرام (`viewport.expand()`)
  - هپتیک فیدبک سبک تلگرام (`haptic.impact('light')`)

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و هدف آن (What This Page Does)
این صفحه **پوسته اصلی و لانچر ورودی مینی‌اپ** است و ساختار آن به شرح زیر عمل می‌کند:

### الف. حالت پیش‌فرض (بدون انتخاب تب):
- نمایش اورب‌های نوری معلق (Emerald & Telegram Blue glow).
- بنر تبلیغاتی اکتیو از کمپین‌های اونر (`adsApi.getActiveAds('dashboard_banner')`) همراه با ثبت خودکار ایمپرشن و قابلیت کلیک.
- اسلوگان اصلی برنامه (`hero.title` و `hero.description`).
- سه تب انتخاب تحلیل:
  1. `username` (آیکون `person_search`)
  2. `collectibles` (آیکون `tag` — شماره‌های ۸۸۸+)
  3. `gifts` (آیکون `featured_seasonal_and_gifts`)
- راهنمای متحرک فلش رو به بالا (`hero.selectToStart`).

### ب. حالت تب فعال (Dynamic Action Sheet):
به محض کلیک کاربر روی هر یک از ۳ تب، با انیمیشن روان Motion.div یک شیت با استایل iOS با دستگیره کشویی (Grab Handle) از پایین باز می‌شود و کامپوننت `ActionArea` اجرا می‌شود:
1. **اگر تب `username` باشد:**
   - فیلد ورودی `@username` با دکمه تحلیل (`action.username.analyzeBtn`).
   - چیپ‌های یوزرنیم‌های ترند تصادفی (`getRandomTrending`) برای تست سریع.
   - پس از زدن دکمه تحلیل، کاربر به `/username?u=...` هدایت می‌شود.
2. **اگر تب `collectibles` باشد:**
   - فرمت خودکار ارقام ورودی به قالب `+888 xxxx xxxx` با `formatLiveNumberInput`.
   - استخرهای آماده الگوهای ترند (Royal & Genesis: `+888 8888`، Apex Mirror، Ladder Runs، Binary Dual).
   - تحلیل اولیه پترن و هدایت کاربر به `/numbers/report?n=...`.
3. **اگر تب `gifts` باشد:**
   - فیلد ورودی لینک گیفت (`https://t.me/nft/...`) یا نام مدل.
   - دکمه‌های گیفت‌های داغ (`PlushPepe-1`, `HeroicHelmet-1`, `DurovsCap-1`).
   - کاتالوگ ۱۲۰ گیفت رسمی تلگرام (`OFFICIAL_GIFTS_120`) با تامبنیل اختصاصی.
   - هدایت به `/gifts/report?g=...`.

---

## ⚡ ۳. هوک‌ها و ارتباط با APIها
- `adsApi.getActiveAds('dashboard_banner')` — لود بنر ادز فعال از پنل اونر
- `adsApi.trackImpression(ad.id)` — ثبت بازدید تبلیغ
- `adsApi.trackClick(ad.id)` — ثبت کلیک تبلیغ
- `PullToRefresh` — اینولیدیت کردن تمام کوئری‌های کش با کشیدن صفحه به پایین

---

## ⚠️ ۴. دستورات و الزامات ایجنت در این صفحه
- [ ] انیمیشن باز شدن شیت اکشن نباید در دستگاه‌های اندروید کند شود.
- [ ] استیت پارامتر `?u=...` در URL برای باز شدن مستقیم تب یوزرنیم از خارج مینی‌اپ حتماً حفظ شود (`getInitialTab`).
- [ ] هپتیک تلگرام در تغییر تب‌ها فعال باشد.
