---
title: "تنظیمات، شخصی‌سازی و امنیت — Settings & Security (SettingsPage & SecurityPage)"
tags:
  - ifragment
  - frontend
  - settings
  - security
  - profile
  - gdpr
  - biometrics
type: frontend-page
route: "/profile/settings, /profile/security"
component: "frontend/src/pages/profile/settings/SettingsPage.tsx & frontend/src/pages/profile/security/SecurityPage.tsx"
status: production
---

# ⚙️ تنظیمات و امنیت پیشرفته — Settings & Security (`SettingsPage` & `SecurityPage`)

این سند مشخصات فنی، چرخه حیات استیت‌ها و الزامات امنیتی دو صفحه حیاتی تنظیمات کاربر (`SettingsPage`) و امنیت و سشن‌ها (`SecurityPage`) را با استناد به سورس‌کد واقعی شرح می‌دهد.

---

## 🧭 ۱. شناسنامه فنی صفحات (Technical Identity)

### ۱. صفحه تنظیمات (`SettingsPage`):
- **مسیر روت:** `/profile/settings`
- **سورس کامپوننت:** [`frontend/src/pages/profile/settings/SettingsPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/profile/settings/SettingsPage.tsx)
- **مدیریت استیت پیش‌نویس (Draft State):** [`frontend/src/entities/user/model/settings.ts`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/entities/user/model/settings.ts)
- **کامپوننت‌های محافظ:** `SettingsGuard` (هشدار خروج بدون ذخیره)، `ToggleSwitch`

### ۲. صفحه امنیت (`SecurityPage`):
- **مسیر روت:** `/profile/security`
- **سورس کامپوننت:** [`frontend/src/pages/profile/security/SecurityPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/profile/security/SecurityPage.tsx)
- **API سشن‌ها و پاکسازی:** `sessionsApi.getSessions`, `deleteAccountGDPR`, `purgeAllUserCache`
- **تعامل با حسگرهای بیومتریک:** Telegram Native Biometric Manager

---

## 🎯 ۲. کارکرد دقیق در کد و امکانات صفحه تنظیمات (`SettingsPage`)

1. **الگوی پیش‌نویس موقت (Draft / Commit / Discard Pattern):**
   - کاربر هنگام ورود با متد `initDraftSettings()` مقادیر ذخیره‌شده را در استیت موقت کپی می‌کند.
   - سیگنال `isSettingsDirty()` در صورت هرگونه تغییر فعال می‌شود.
   - در صورت تغییر، تلگرام مانع از بستن ناگهانی مینی‌اپ می‌شود (`enableClosingConfirmation()`).
   - در صورت تلاش برای بازگشت با تغییرات ذخیره‌نشده، مودال `SettingsGuard` فعال می‌شود که سه گزینه دارد: ذخیره و خروج، دور انداختن تغییرات، ماندن در صفحه.
2. **شخصی‌سازی زبان و جهت صفحه (i18n & RTL):**
   - پشتیبانی از زبان‌های فارسی (`fa`)، انگلیسی (`en`) و روسی (`ru`).
   - جابجایی بلادرنگ راست‌چین و چپ‌چین با متد `setLocale`.
3. **مجوزهای تلگرام و نوتیفیکیشن‌ها (Telegram Bot Write Access):**
   - فعال‌سازی نوتیفیکیشن‌ها (ماینینگ، ریفرال، اعلانات سوپرگروه و پروموها) نیاز به مجوز رسمی ارسال پیام تلگرام دارد (`requestWriteAccess()`).
   - در صورت رد درخواست توسط کاربر، هپتیک خطا و آلرت مناسب نمایش داده می‌شود.
4. **تنظیمات صدا، هپتیک و عملکرد:**
   - سوییچ فعال/غیرفعال‌سازی افکت‌های صوتی نئومورفیک (`audio.playSuccess()`, `audio.playToggle()`).
   - تنظیم شدت هپتیک فیدبک کلاینت.
   - فعال‌سازی حالت صرفه‌جویی در مصرف دیتا (غیرفعال‌سازی لود ویدیوهای سنگین Lottie).

---

## 🛡️ ۳. کارکرد دقیق در کد و امکانات صفحه امنیت (`SecurityPage`)

1. **مدیریت و رصد نشست‌های فعال (Active Sessions Management):**
   - فراخوانی `sessionsApi.getSessions()` جهت دریافت آی‌پی‌ها، مرورگرها (User-Agent) و زمان آخرین اتصال.
   - دکمه انحصاری «ابطال تمام نشست‌های دیگر» (Terminate Other Sessions) که توکن‌های فعال روی سایر دستگاه‌ها را منقضی می‌کند.
2. **احراز هویت بیومتریک تلگرام (Biometric Authentication):**
   - ارتباط مستقیم با متد `biometric.requestAccess()` تلگرام جهت استفاده از FaceID یا اثر انگشت برای انجام تراکنش‌های حساس یا مشاهده دارایی‌های خصوصی.
3. **پاکسازی کامل کش و دیتا (Purge All Cache):**
   - متد `purgeAllUserCache()` تمام کوئری‌های ذخیره‌شده در ایندکسد دی‌بی و لوکال استوریج را بدون دستکاری اطلاعات سرور پاک می‌کند تا باگ‌های حافظه موقت برطرف شود.
4. **حذف حساب کاربری مطابق قانون GDPR (Account Deletion & Data Right):**
   - دیالوگ هشدار تأیید مضاعف (`showConfirm`).
   - متد `deleteAccountGDPR()` برای ناشناس‌سازی و پاکسازی دیتای کاربر در پایگاه داده PostgreSQL.
   - خروج فوری و تمیز از مینی‌اپ با متد `closeMiniApp()`.

---

## ⚡ ۴. هوک‌ها و رویدادهای سیستمی
- `useTelegramBackButton(-1)` جهت ناوبری یکپارچه با کلاینت اندروید/iOS تلگرام
- `createEffect` جهت همگام‌سازی استیت دایرتی با `enableClosingConfirmation()`
- هپتیک فیدبک‌های تفکیک‌شده: `haptic.selection()`, `haptic.notify('success')`, `haptic.notify('error')`

---

## ⚠️ ۵. خطوط قرمز و الزامات توسعه‌دهندگان
1. **امنیت دیتای کاربر:** متد حذف حساب کاربری GDPR نباید بدون هشدار و کانفرم ۲ مرحله‌ای اجرا شود.
2. **عدم نشت استیت:** قبل از خروج از کامپوننت، حتماً `disableClosingConfirmation()` در تابع `onCleanup` اجرا شود تا خروج از سایر صفحات بلاک نشود.
3. **پایداری توکن سشن:** پس از ابطال سایر نشست‌ها، سشن جاری (`current_token`) کاربر در مرورگر فعال باقی بماند.

---

## 🔗 صفحات مرتبط
- [[14 - Profile (ProfilePage)|۱۴. پروفایل کاربری]]
- [[15 - Profile Achievements (AchievementsPage)|۱۵. دستاوردهای کاربری]]
- [[02 - Backend (Go & Docker)|۰۲. معماری بک‌اند و مدیریت سشن‌ها]]
