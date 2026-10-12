---
title: "🏆 صفحه لیدربورد کامیونیتی — Group Leaderboard (`LeaderboardPage`)"
tags:
  - frontend
  - gamification
  - ifragment
  - leaderboard
  - page
  - ui
type: frontend-page
status: production
---

# 🏆 صفحه لیدربورد کامیونیتی — Group Leaderboard (`LeaderboardPage`)

این سند مشخصات فنی و سیستم گیمیفیکیشن صفحه **لیدربورد ماهانه گروه Fragment Investors** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/leaderboard` و `/profile/leaderboard`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/profile/leaderboard/ui/LeaderboardPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/profile/leaderboard/ui/LeaderboardPage.tsx)
- **وابستگی به گروه تلگرام:** سوپرگروه رسمی `@FragmentInvestors`
- **لینک‌های اختصاصی:**
  - عضویت و مشاهده گروه: `https://t.me/FragmentInvestors`
  - بوست کردن گروه: `https://t.me/boost/FragmentInvestors`

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و سیستم رتبه‌بندی

### ۱. دو تب رقابتی اصلی (`activeTab`):
1. **تب پیام‌ها (`messages` - 💬):** رتبه‌بندی بر اساس تعداد پیام‌های مفید و مشارکت در بحث‌های گروه.
2. **تب بوست‌ها (`boosts` - 🚀):** رتبه‌بندی کاربران بر اساس تعداد بوست‌های فعال تلگرام اختصاص‌داده‌شده به گروه.

### ۲. بخش‌های بصری لیدربورد:
- **سکوی ۳ نفر برتر (Top 3 Podium):** نمایش ویژه نفرات اول، دوم و سوم با مدال‌های طلا، نقره و برنز، آواتار تلگرام و افکت درخشش.
- **جایگاه کاربر من (`myStats` & `myResolvedRank`):** نمایش پین‌شده رتبه و امتیاز کاربر جاری در انتهای صفحه حتی اگر در صفحه اول نباشد.
- **لیست کاربران ۱۰۰ نفر برتر:** نمایش رتبه، عکس پروفایل، یوزرنیم، تگ پرمیوم و امتیاز فرمت‌شده (مثلاً `1.2M` یا `45K`).
- **مدال پروفایل کاربر انتخاب‌شده (`selectedUser`):** باز شدن مدال جزئیات هنگام کلیک روی هر کاربر.

### ۳. دکمه‌های اقدام به عمل (Call to Action):
- دکمه بنفش-آبی **«Open Group»** برای ورود به سوپرگروه با `openTelegramLink`.
- دکمه نئونی **«Boost Group»** برای باز کردن مستقیم پاپ‌آپ بوست تلگرام.

---

## ⚡ ۳. هوک‌ها و فراخوانی‌های بک‌اند
- `getGroupLeaderboard(activeTab(), currentUserId)` — واکشی دیتا از بک‌اند Go با کش ۱ دقیقه‌ای و رفرش دوره‌ای ۲ دقیقه‌ای (`refetchInterval: 120000`)

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] ریست لیدربورد در ابتدای هر ماه میلادی (مانند میگریشن 000106) انجام می‌شود و نباید داده‌های تاریخی کاربران پاک شود.
- [ ] در صورت کلیک دکمه بازگشت با `backButton.onClick`، کاربر به `/` هدایت شود.
