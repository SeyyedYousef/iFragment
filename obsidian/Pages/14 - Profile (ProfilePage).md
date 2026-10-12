---
title: "👤 صفحه پروفایل کاربر — Profile Page (`ProfilePage`)"
tags:
  - frontend
  - ifragment
  - page
  - profile
  - ui
  - user
type: frontend-page
status: production
---

# 👤 صفحه پروفایل کاربر — Profile Page (`ProfilePage`)

این سند مشخصات فنی و تجربه کاربری صفحه **پروفایل کاربری، گالری دارایی‌ها و تنظیمات** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/profile` (و زیرمسیرهای `/profile/settings` و `/profile/security`)
- **فایل کامپوننت اصلی:** [`frontend/src/pages/profile/profile/ui/ProfilePage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/profile/profile/ui/ProfilePage.tsx)
- **ویجت‌های درون صفحه:**
  - هدر هویت و کاربر: `IdentityHero`
  - گالری دارایی‌های من: `MyAssetsGallery`
  - پیش‌نمایش دستاوردها: `AchievementPreview`
  - درگاه مخفی ورود اونر: `OwnerGateModal` و هوک `useSecretTrigger`
  - منوی ناوبری پایین: `BottomNav`

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

### ۱. بارگذاری سریع با کش آفلاین (`getCachedStats`):
- خواندن فوری آخرین آمار و موجودی کاربر از `localStorage` (`cached_profile_stats_${uid}`) برای حذف کامل صفحه لودینگ سفید.
- همگام‌سازی نامتقارن با کوئری `getProfileStats()` در پس‌زمینه.

### ۲. بخش‌های کلیدی صفحه:
- **`IdentityHero`:** نمایش عکس پروفایل تلگرام، نام، شناسه عددی Telegram User ID، موجودی امتیازات Airdrop، توکن‌های FRG و کریدیت‌های تحلیلی.
- **`MyAssetsGallery`:** نمایش تب‌دار دارایی‌های تحت تملک کاربر شامل شماره‌های ۸۸۸+ و گیفت‌های تلگرام خریداری یا آنلاک شده.
- **`AchievementPreview`:** نمایش مدال‌ها و نشان‌های بازشده همراه با دکمه ورود به صفحه کامل دستاوردها (`/profile/achievements`).
- **سیستم رفرال و دعوت دوستان:** دریافت لینک اختصاصی رفرال با `getReferralInfo` و دکمه کپی و ارسال به مخاطبین تلگرام.
- **تغییر زبان برنامه (`setLocale`):** منوی پاپ‌آپ سوییچ بین فارسی (`fa`) و انگلیسی (`en`) با پشتیبانی کامل از چینش راست‌به‌چپ (RTL).
- **درگاه مخفی ورود سید یوسف (`useSecretTrigger`):** مکانیزم کلیک چندگانه مخفی برای باز شدن مودال ورود به پنل ادمین (`OwnerGateModal`) با رمز عبور و احراز هویت دومرحله‌ای TOTP.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `getProfileStats()` — واکشی وضعیت کاربر و آواتار
- `getProfileAchievements()` — لیست اچیومنت‌ها
- `getReferralInfo()` — آمار زیرمجموعه‌ها و پاداش‌ها
- `setProfilePhotoUrl(...)` — به‌روزرسانی آدرس عکس پروفایل تلگرام

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] ذخیره و همگام‌سازی استیت در `localStorage` به هیچ وجه نباید با خطای پارس JSON مواجه شود.
- [ ] درگاه امنیتی ورود اونر (`OwnerGateModal`) باید در تولید کاملاً محافظت‌شده و بدون نشت کلید باشد.
