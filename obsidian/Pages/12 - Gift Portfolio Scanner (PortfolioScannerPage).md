---
title: "🎁 صفحه اسکنر پورتفولیوی گیفت — Portfolio Scanner (`PortfolioScannerPage`)"
tags:
  - frontend
  - gifts
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🎁 صفحه اسکنر پورتفولیوی گیفت — Portfolio Scanner (`PortfolioScannerPage`)

این سند مشخصات فنی و تجربه کاربری ابزار **اسکن پورتفولیو و موجودی گیفت‌های والت کاربران** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/gifts/portfolio`
- **فایل کامپوننت اصلی:** [`frontend/src/pages/gifts/portfolio/ui/PortfolioScannerPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/portfolio/ui/PortfolioScannerPage.tsx)
- **سطح دسترسی:** عمومی

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و داده‌های نمایشی

### ۱. ورودی و اسکن آدرس والت یا یوزرنیم:
- دریافت یوزرنیم یا آدرس کیف‌پول از اینپوت یا کوئری‌پارامتر URL (`?u=...` یا `?address=...`).
- فراخوانی میوتیشن `giftsApi.scanPortfolio(targetUser)`.

### ۲. نمایش آماری پورتفولیو (`PortfolioScanResponse`):
- **ارزش کل تخمینی:** محاسبه جمع ارزش کل گیفت‌های موجود در والت بر حسب GRAM/TON و معادل دلاری USD (`formatGram`, `formatUsd`).
- **لیست گیفت‌های با بالاترین ارزش (`top_valued_gifts`):**
  - نام مدل گیفت و تصویر
  - شماره سریال (Serial Number)
  - ارزش تخمینی بر اساس موتور ارزش‌گذاری
  - رتبه نایابی (Rarity Tier)

### ۳. استخراج و دانلود گزارش CSV (`exportCSV`):
- دکمه دانلود مستقیم گزارش موجودی با فرمت `.csv`:
  `telegram_gifts_{username}.csv`
- شامل ستون‌های: `Gift ID`, `Model`, `Serial Number`, `Estimated Value (GRAM)`, `Estimated Value (USD)`, `Rarity Tier`.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `giftsApi.scanPortfolio(targetUser)` — فراخوانی اسکنر آنچین در بک‌اند

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] در صورت وارد کردن کاراکتر `@` در ابتدای یوزرنیم، استرینگ تریم شده و نرمال شود.
- [ ] تولید فایل CSV با انکودینگ UTF-8 و کاملاً منطبق با اکسل انجام شود.
