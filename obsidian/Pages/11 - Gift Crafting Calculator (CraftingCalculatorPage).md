---
title: "🎁 صفحه ماشین‌حساب کرفتینگ — Crafting Calculator (`CraftingCalculatorPage`)"
tags:
  - frontend
  - gifts
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🎁 صفحه ماشین‌حساب کرفتینگ — Crafting Calculator (`CraftingCalculatorPage`)

این سند مشخصات فنی و منطق ریاضی ابزار **ماشین‌حساب و شبیه‌ساز کرفتینگ گیفت‌های تلگرام** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/gifts/crafting`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/gifts/crafting/ui/CraftingCalculatorPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/crafting/ui/CraftingCalculatorPage.tsx)
- **سطح دسترسی:** عمومی

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و محاسبات ریاضی

### ۱. مدیریت اسلات‌های ورودی کرفتینگ (`slots`):
- قابلیت افزودن **۱ تا ۴ اسلات گیفت** به عنوان ورودی فرآیند کرفت/ترکیب.
- فیلدهای هر اسلات:
  - نام گیفت و مدل (`modelId`)
  - شماره سریال (`serial`)
  - ارزش تخمینی بر حسب گرم/تون (`valueGram`)
  - شانس موفقیت ساخت بر مبنای در هزار (`craftChancePermille`)
- دکمه‌های افزودن اسلات (`addSlot`) و حذف اسلات (`removeSlot`).

### ۲. قانون سخت‌گیرانه کرفتینگ تلگرام (Collection Integrity):
- تمام گیفت‌های قرارگرفته در اسلات‌های ورودی **باید متعلق به یک کالکشن واحد** باشند (مثلاً همگی از کالکشن `plush_pepe`). در غیر این صورت سرور خطای اعتبارسنجی بازمی‌گرداند.

### ۳. شبیه‌سازی تصادفی مونت‌کارلو (Monte Carlo EV Simulation):
- با زدن دکمه محاسبه، میوتیشن `giftsApi.calculateCraftingEV` اجرا می‌شود.
- محاسبه ارزش انتظاری (Expected Value): آیا ترکیب این آیتم‌ها از نظر ریاضی سودآور است (+EV) یا ارزش دارایی سوخته‌شده بیشتر از شانس آیتم جدید است (-EV)؟
- فیدبک هپتیک موفقیت یا خطا (`haptic.notify('success')` / `haptic.notify('error')`).

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `giftsApi.calculateCraftingEV(...)` — ارسال آرایه اسلات‌ها به بک‌اند جهت اجرای محاسبات آماری

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] تعداد اسلات‌ها هرگز نباید بیشتر از ۴ عدد شود (`slots().length >= 4`).
- [ ] پیام خطای سرور برای آیتم‌های غیرهمگن باید کاملاً واضح و به زبان کاربر نمایش داده شود.
