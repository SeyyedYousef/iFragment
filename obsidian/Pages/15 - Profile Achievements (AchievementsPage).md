---
title: "🏅 صفحه دستاوردها و نشان‌ها — Achievements (`AchievementsPage`)"
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

# 🏅 صفحه دستاوردها و نشان‌ها — Achievements (`AchievementsPage`)

این سند مشخصات فنی و سیستم گیمیفیکیشن صفحه **دستاوردها، نشان‌ها و افتخارات کاربران** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/profile/achievements`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/profile/achievements/AchievementsPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/profile/achievements/AchievementsPage.tsx)
- **سطح دسترسی:** عمومی و کاربران لاگین‌شده

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و سیستم گیمیفیکیشن

### ۱. دسته‌بندی ۸ گانه دستاوردها (`categories`):
- `all` (همه دستاوردها)
- `onboarding` (آشنایی اولیه، اتصال والت، شروع فعالیت)
- `mining` (ماینینگ و تسک‌های روزانه)
- `analysis` (ارزش‌گذاری یوزرنیم‌ها، شماره‌ها و گیفت‌ها)
- `social` (دعوت دوستان، عضویت در سوپرگروه)
- `management` (فعالیت‌های مدیریتی)
- `streaks` (استمرار حضور روزانه در ربات)
- `special` (جوایز و ایونت‌های ویژه)

### ۲. ادغام تعاریف سرور و کلاینت (`mergedAchievements`):
- ترکیب تعاریف ثابت محلی (`ACHIEVEMENT_DEFS`) با آمار ارسالی سرور (`defsQuery`) و میزان پیشرفت فعلی کاربر (`achievementsQuery`).
- نوار پیشرفت درصد تکمیل (Progress Bar) به سمت تارگت نهایی (مثلاً ۵ از ۱۰).
- وضعیت باز شده (`unlocked`) و تاریخ باز شدن (`unlockedAt`).

### ۳. اشتراک‌گذاری در استوری تلگرام (`handleShareToStory`):
- قابلیت اشتراک‌گذاری مستقیم دستاورد بازشده با دکمه دیپ‌لینک تلگرام:
  `https://t.me/iFragmentBot/iFragment?startapp=ach_{id}`
- جذب کاربران جدید از طریق استوری‌های تلگرامی کاربران.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `getProfileAchievements()` — درصد پیشرفت دستاوردهای کاربر
- `getAchievementDefs()` — تعاریف و تارگت‌های رسمی از بک‌اند

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] در صورت آفلاین بودن یا خطای شبکه، تعاریف پیش‌فرض محلی (`ACHIEVEMENT_DEFS`) با پیشرفت صفر رندر شوند تا صفحه خالی نماند.
