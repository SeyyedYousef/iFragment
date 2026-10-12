---
title: "🎨 03 - Frontend (SolidJS & TMA)"
tags:
  - frontend
  - ifragment
  - solidjs
  - tma
type: architecture
status: production
---

# 🎨 03 - Frontend (SolidJS & TMA)

فرانت‌اند **iFragment** یک تلگرام مینی‌اپ مدرن و بسیار سریع است که بر پایه **SolidJS** و **Vite** پیاده‌سازی شده و از مکانیزم سیگنال‌ها (Fine-grained Reactivity) بهره می‌برد.

---

## 🏗️ ساختار پروژه فرانت‌اند

```text
frontend/
├── src/
│   ├── assets/            # تصاویر، آیکون‌ها و فونت‌ها
│   ├── components/        # کامپوننت‌های عمومی و قابل استفاده مجدد
│   ├── pages/             # صفحات اصلی اپلیکیشن
│   │   ├── home/          # داشبورد اصلی حراجی‌ها و ترندها
│   │   ├── explore/       # جستجو و فیلتر یوزرنیم‌ها و شماره‌ها
│   │   ├── gifts/         # کاتالوگ گیفت‌های تلگرام و کمیابی
│   │   └── profile/       # پروفایل کاربر و لیدربورد (Leaderboard)
│   ├── services/          # کلاینت‌های API و فراخوانی بک‌اند
│   ├── stores/            # مدیریت وضعیت سراسری با کریپت و سیگنال‌ها
│   └── App.tsx            # روتینگ و پوسته اصلی برنامه
├── vite.config.ts         # تنظیمات بیلد و پلاگین‌ها
└── package.json
```

---

## ⚡ مزایای انتخاب SolidJS در مینی‌اپ
- **بدون Virtual DOM:** عملکرد مستقیم روی DOM که باعث اجرای بسیار روان در دستگاه‌های ضعیف موبایل می‌شود.
- **حجم باندل بسیار کم:** سرعت لود لحظه‌ای مینی‌اپ در کلاینت تلگرام.
- **انطباق تم (Telegram Theme Integration):** تغییر آنی متغیرهای CSS بر اساس تم سیستم‌عامل کاربر (`themeParams` در تلگرام).

---

## 🚀 توسعه و اجرای محلی

```bash
# نصب وابستگی‌ها
npm install

# اجرای سرور توسعه محلی Vite
npm run dev

# ایجاد خروجی بهینه‌سازی‌شده برای کلودفلر
npm run build
```

---

## 🔗 صفحات مرتبط
- [[01 - Architecture & Overview]]
- [[04 - Fragment Domain & Smart Contracts]]
