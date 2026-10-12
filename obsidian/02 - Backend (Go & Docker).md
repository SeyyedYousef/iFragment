---
title: "⚙️ 02 - Backend (Go & Docker)"
tags:
  - backend
  - docker
  - golang
  - ifragment
type: infrastructure
status: production
---

# ⚙️ 02 - Backend (Go & Docker)

بک‌اند iFragment با زبان برنامه‌نویسی **Go 1.25** نوشته شده است و در قالب محیط کانتینری داکر مدیریت می‌شود.

---

## 📁 ساختار ماژول‌ها و پکیج‌ها

```text
backend/
├── cmd/api/               # نقطه ورود سرور API (main.go)
├── internal/
│   ├── config/            # لود متغیرهای محیطی و تنظیمات
│   ├── database/          # اتصال به PostgreSQL و اجرای مایگریشن‌ها
│   ├── cache/             # اتصال و هلپرهای DragonflyDB / Redis
│   ├── model/             # ساختارهای داده و Entityها
│   ├── repository/        # ارتباط مستقیم با دیتابیس (SQL Queries)
│   ├── service/           # منطق بیزینس (GroupLeaderboard, Sales, Auctions, etc.)
│   ├── router/            # تعریف روت‌ها و روتینگ Chi
│   └── middleware/        # احراز هویت HMAC initData تلگرام، لاگر و CORS
└── migrations/            # اسکریپت‌های SQL مایگریشن دیتابیس (up / down)
```

---

## 🛠️ دستورات پرکاربرد توسعه محلی (Local Development)

```bash
# راه‌اندازی استک محلی (PostgreSQL + DragonflyDB)
docker compose up -d

# اجرای تست‌های بک‌اند
go test ./...

# اجرای مستقیم سرور در محیط توسعه
go run ./cmd/api
```

---

## 🔐 امنیت و اعتبارسنجی تله‌گرام (HMAC Validation)

هر درخواست ارسال شده از سمت تلگرام مینی‌اپ حاوی رشته‌ی رمزنگاری‌شده `initData` است.
الگوریتم اعتبارسنجی:
1. توکن بات تلگرام توسط کلید ثابت هش شده و کلید اختصاصی `secret_key` تولید می‌شود:
   $$\text{secret\_key} = \text{HMAC-SHA256}(\text{"WebAppData"}, \text{bot\_token})$$
2. پارامتر `hash` از کوئری حذف می‌شود و بقیه پارامترها به صورت الفبایی با کاراکتر `\n` به هم متصل می‌گردند (`data_check_string`).
3. هش محاسبه شده با `hash` مقایسه می‌شود. در صورت تطابق، هویت کاربر و تاریخ اعتبار تأیید می‌شود.

---

## 🔗 صفحات مرتبط
- [[01 - Architecture & Overview]]
- [[05 - Database & Migrations]]
- [[06 - VPS Deployment & Operations]]
