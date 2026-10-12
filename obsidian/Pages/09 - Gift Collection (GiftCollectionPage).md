---
title: "🎁 صفحه تحلیل کالکشن گیفت — Gift Collection (`GiftCollectionPage`)"
tags:
  - frontend
  - gifts
  - ifragment
  - page
  - ui
type: frontend-page
status: production
---

# 🎁 صفحه تحلیل کالکشن گیفت — Gift Collection (`GiftCollectionPage`)

این سند مشخصات فنی و تجربه کاربری جامع صفحه **تحلیل عمیق کالکشن‌های گیفت تلگرام** است.

---

## 🧭 ۱. شناسنامه فنی صفحه
- **مسیر روت در برنامه:** `/gifts/collection` (با پارامتر `?c=slug`)
- **فایل کامپوننت اصلی:** [`frontend/src/pages/gifts/collection/ui/GiftCollectionPage.tsx`](file:///c:/Users/DEll/Desktop/iFragment/frontend/src/pages/gifts/collection/ui/GiftCollectionPage.tsx)
- **۷ تب تخصصی صفحه (`CollectionTabKey`):**
  1. `market` (چارت کف قیمت و حجم)
  2. `sales` (تاریخچه معاملات زنده)
  3. `items` (کاوشگر اقلام بر اساس شماره و نایابی)
  4. `attributes` (تفکیک مدل‌ها، سمبل‌ها و بک‌دراپ‌ها)
  5. `venues` (رادار آربیتراژ و مقایسه مارکت‌ها)
  6. `heatmap` (هیت‌مپ رنگی دلتا-ای و نایابی)
  7. `laya` (توصیه‌ها و اقدامات استراتژیک لایا)

---

## 🎯 ۲. کارکرد واقعی این صفحه در کد و اجزای ویجتی

### ۱. انتخاب‌گر کالکشن و سرچ:
- قابلیت جستجوی زنده در میان کل کالکشن‌های گیفت با `collectionsQuery`.
- کپی سریع آدرس اسمارت‌کانترکت TEP-62 در کلیپ‌بورد با هپتیک فیدبک (`copyContract`).

### ۲. اجزای کلیدی تب‌ها:
- **`GiftFloorChart` (تب market):** نمودار خطی کف قیمت در بازه‌های ۲۴ ساعته، ۷ روزه و ۳۰ روزه.
- **`CollectionRarityHeatmap` و `GiftDeltaEHeatmap` (تب heatmap):** نقشه‌های حرارتی تضاد نوری و کمیابی پالت رنگی بک‌دراپ.
- **`GiftArbitrageRadar` (تب venues):** مقایسه کف قیمت در ۷ مارکت‌پلیس مختلف و شناسایی فرصت‌های آربیتراژ سودآور.
- **`GiftWhaleTracker`:** رصد نهنگ‌ها و متمرکز بودن مالکیت کالکشن در والت‌های بزرگ.
- **تب صفات (attributes):** زیرتب‌های تفکیکی:
  - `models` (مدل‌های سه‌بعدی و فراوانی آن‌ها)
  - `symbols` (نمادها و الگوها)
  - `backdrops` (رنگ‌ها و پالت‌های نوری)
- **تب اقلام (items):** فیلتر بر اساس شماره صدور، مرتب‌سازی صعودی/نزولی، فیلتر آیتم‌های برای فروش.

---

## ⚡ ۳. هوک‌ها و اتصال به APIها
- `giftsApi.listCollections()` — لیست همه کالکشن‌ها
- `giftsApi.getCollectionIntel(slug)` — داده‌های عمیق کالکشن انتخاب‌شده

---

## ⚠️ ۴. الزامات فنی ایجنت در این صفحه
- [ ] اسلاگ کالکشن حتماً در URL با حروف کوچک و بدون فاصله هندل شود (`replace(/[\s_]+/g, '-')`).
- [ ] صفحه‌بندی تب‌های `sales` و `items` بدون پرش اسکرول صفحه انجام گیرد.
