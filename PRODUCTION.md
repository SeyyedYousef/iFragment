# 🛡️ iFragment — Production Architecture & Deployment Guide

> **Release Version:** `v1.0.0` (Production Hardened — 2026 Edition)  
> **Status:** Verified & Operational  
> **Target Environment:** Hybrid Cloud (Cloudflare Pages + Ubuntu Linux VPS)

---

## 🏛️ System Topology

```mermaid
flowchart TB
    subgraph Clients["Edge Clients"]
        TMA["Telegram Mini App (Mobile / Desktop)"]
        WEB["Web Browser (PWA)"]
    end

    subgraph Edge["Edge Layer — Cloudflare"]
        CF["Cloudflare Pages (Global CDN & Edge SSL)"]
    end

    subgraph VPS["Production VPS — 109.172.94.139"]
        subgraph Ingress["Reverse Proxy"]
            CADDY["Caddy Server (Auto Let's Encrypt TLS)"]
        end

        subgraph Containers["Docker Virtual Network"]
            API["Go 1.25 REST / Webhook Engine (:8080)"]
            DRAGON["DragonflyDB (In-Memory Multi-Threaded Redis)"]
            PG["PostgreSQL 17 Primary Database"]
        end
    end

    subgraph Upstream["Decentralized Networks & Upstreams"]
        TON["TON Blockchain (TonApi / LiteServers)"]
        FRAG["Telegram Fragment Marketplace"]
        BOT["Telegram Bot API (Webhook)"]
    end

    TMA --> CF
    WEB --> CF
    CF --> CADDY
    CADDY --> API
    API --> DRAGON
    API --> PG
    API --> TON
    API --> FRAG
    API --> BOT
```

---

## ⚙️ Core Technology Specifications

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | SolidJS + Vite | 1.9+ / Vite 6.4 | 120fps Zero-VDOM Mobile WebView Interface |
| **Styling** | Tailwind CSS v4 + Glassmorphism | 4.3+ | Telegram Native Theming (Dark/Light/RTL) |
| **Backend** | Go (Golang) | 1.25+ | High-throughput async engine, sub-millisecond latency |
| **Database** | PostgreSQL | 17-alpine | Primary transactional store with 100 idempotent migrations |
| **Caching** | DragonflyDB | 1.28+ | High-throughput, multi-threaded cache (Redis 7+ API) |
| **Reverse Proxy** | Caddy Server | 2.9+ | Automatic TLS, HTTP/3, and Gzip/Zstandard compression |
| **Edge Hosting** | Cloudflare Pages | Edge | Global CDN distribution for frontend assets |

---

## 🔐 Environment & Secret Security

All production secrets live exclusively in `/opt/ifragment/.env` on the host VPS. **Never commit, print, or expose `.env` files.**

### Critical Environment Variables Checklist

```env
# Application
APP_ENV=production
APP_PORT=8080
LOG_LEVEL=info

# Database (PostgreSQL 17)
DATABASE_URL=postgres://ifragment_user:${DB_PASSWORD}@postgres:5432/ifragment?sslmode=disable
POSTGRES_USER=ifragment_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=ifragment

# Cache (DragonflyDB)
REDIS_URL=redis://dragonfly:6379/0

# Telegram Mini App & Bot
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_BOT_SECRET_TOKEN=${WEBHOOK_SECRET}
TELEGRAM_BOT_USERNAME=iFragmentBot

# Security & Crypto
INIT_DATA_HMAC_SECRET=${TELEGRAM_BOT_TOKEN}
JWT_SECRET=${SECURE_RANDOM_KEY}
ENCRYPTION_KEY_32B=${AES_256_HEX}

# Blockchain & External APIs
TONAPI_KEY=${TONAPI_AUTH_TOKEN}
TON_NETWORK=mainnet
FRAGMENT_SCRAPER_RATE_LIMIT=10
```

---

## 🚀 Deployment Workflows

### 1. Frontend Automated Deployment (Cloudflare Pages)
- Push to branch `main` triggers Cloudflare Pages automated build pipeline.
- Build command: `npm run build` inside `frontend/`.
- Output directory: `frontend/dist`.
- Edge caching and instant global invalidation are handled automatically.

### 2. Backend VPS Deployment
The backend runs via Docker Compose on the production server.

```bash
# SSH into host (Authorized tasks only)
cd /opt/ifragment

# Pull latest code
git fetch origin main
git checkout main
git pull origin main

# Verify no git drift
git log -1 --format="%h - %s (%ci)"

# Build and start services in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# Inspect running containers
docker compose -f docker-compose.prod.yml ps
```

---

## 🩺 Health & Readiness Verification

Never rely on HTTP 200 alone. The health check pipeline consists of three validation layers:

1. **Liveness & DB/Cache Readiness Probe:**
   ```bash
   curl -s -i https://109-172-94-139.sslip.io/api/v1/healthz/ready
   ```
   *Expected Response:* `HTTP/1.1 200 OK` with JSON `{"status":"ok","db":"ready","cache":"ready"}`.

2. **Git Commit Drift Verification:**
   Ensure the running binary corresponds to the latest `origin/main` commit:
   ```bash
   git rev-parse HEAD
   ```

3. **Telegram Webhook Verification:**
   Ensure the production webhook is properly registered and no secondary consumer is attached:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

---

## 🔄 Database Migrations & Rollback

- Migrations run automatically during API container startup (`backend/cmd/api/main.go`).
- All migrations are located in `backend/migrations/` and must adhere strictly to **Idempotency** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- In case of a migration failure:
  1. Inspect container logs: `docker compose -f docker-compose.prod.yml logs api --tail=100`
  2. Perform manual roll-forward or rollback using `migrate` CLI.
  3. Never skip migration version sequences.

### Daily Backup Routine:
```bash
# Automated database snapshot
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U ifragment_user ifragment | gzip > /opt/ifragment/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 🛡️ Production Incident Rules

1. **VPS Isolation:** Never connect to the VPS via SSH without explicit instructions and task scope.
2. **Bot Token Exclusivity:** Never start local polling against the production Telegram Bot token (returns Telegram `409 Conflict`).
3. **Graceful Shutdown:** The Go API engine listens to `SIGINT` and `SIGTERM`, providing 15-second grace periods for in-flight transactions before terminating connections.
