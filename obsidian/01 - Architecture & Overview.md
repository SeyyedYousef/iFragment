---
title: "🏛️ 01 - Architecture & Overview"
tags:
  - architecture
  - ifragment
  - system-design
type: architecture
status: production
---

# 🏛️ 01 - Architecture & Overview

پروژه **iFragment** یک پلتفرم جامع در قالب تلگرام مینی‌اپ (Telegram Mini App) برای مانیتورینگ، تحلیل، تخمین قیمت و رصد حراجی‌ها و فروش‌های پلتفرم رسمی **Fragment.com** (شامل یوزرنیم‌ها، شماره‌های ناشناس 888+ و گیفت‌های تلگرام) است.

---

## 📊 دیاگرام کلان معماری (System Overview)

```mermaid
flowchart TD
    subgraph Clients["👤 کاربران و کلاینت‌ها"]
        TG["Telegram Client (Mobile / Desktop)"]
    end

    subgraph CDN["⚡ لایه توزیع فرانت‌اند"]
        CF["Cloudflare Pages<br/>(SolidJS + Vite Build)"]
    end

    subgraph ProductionVPS["🖥️ سرور پروداکشن (109.172.94.139)"]
        Caddy["Caddy Reverse Proxy<br/>(SSL + Rate Limit)"]
        GoAPI["Go 1.25 API Backend<br/>(Chi Router + Clean Arch)"]
        PG[("PostgreSQL 17<br/>(Primary Storage)")]
        DF[("DragonflyDB<br/>(High-speed Cache & Sessions)")]
        Bot["iFragmentBot Webhook Listener"]
    end

    subgraph External["🌐 سرویس‌ها و شبکه‌های خارجی"]
        Frag["Fragment.com Marketplace"]
        TON["TON Blockchain & Telemint Contracts"]
        TGApi["Telegram Bot API"]
    end

    TG -->|باز کردن مینی‌اپ| CF
    TG -->|درخواست‌های API با HMAC initData| Caddy
    Caddy --> GoAPI
    GoAPI --> PG
    GoAPI --> DF
    TGApi -->|Webhook Events| Bot
    Bot --> GoAPI
    GoAPI -->|Scraping / RPC / Indexing| Frag
    GoAPI -->|On-Chain Query| TON
```

---

## 🧩 اجزای سیستم (System Components)

### ۱. فرانت‌اند (Frontend)
- **فناوری:** SolidJS + Vite + TypeScript
- **استقرار:** Cloudflare Pages (دیپلوی خودکار در هر Push به شاخه `main`)
- **طراحی و تجربه کاربری:** بهینه‌سازی شده برای تم‌های تاریک/روشن تلگرام و تعامل سریع بدون لَگ با ساختار سیگنال‌های SolidJS.

### ۲. بک‌اند (Backend)
- **فناوری:** Go 1.25
- **فریم‌ورک/روتر:** Chi Router
- **معماری:** Clean Architecture (Router -> Service -> Repository -> Model)
- **احراز هویت:** اعتبارسنجی رمزنگاری‌شده `initData` با استفاده از الگوریتم HMAC-SHA256 بر پایه توکن بات.

### ۳. دیتابیس و کَش (Database & Cache)
- **PostgreSQL 17:** نگهداری تاریخچه تراکنش‌ها، کاربران، حراجی‌ها و جداول فروش.
- **DragonflyDB:** جایگزین فوق سریع ردیس برای کش نتایج پرتکرار، آمار زنده و کش قیمت‌ها.

---

## 🔗 صفحات مرتبط
- [[02 - Backend (Go & Docker)]]
- [[03 - Frontend (SolidJS & TMA)]]
- [[04 - Fragment Domain & Smart Contracts]]
