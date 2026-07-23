# 🚀 iFragment - High-Performance Telegram Mini App & Web Platform

[![Project Status: Completed](https://img.shields.io/badge/Status-Completed%20%26%20Verified-emerald?style=for-the-badge)](PRODUCTION.md)
[![Stack: SolidJS + Go](https://img.shields.io/badge/Stack-SolidJS%20%7C%20Go%201.22%20%7C%20PostgreSQL-3390ec?style=for-the-badge)](docs/decisions/ADR-001-architecture-overview.md)

**iFragment** is a Telegram Mini App (TMA) and Web Application engineered for ultra-fast performance, high-concurrency Telegram user interactions, fragment marketplace features, channel/group auto-response, and gamified airdrop systems.

---

## 🌟 Architecture & Tech Stack

### 📱 Frontend (SolidJS + Vite)
- **Framework:** [SolidJS](https://solidjs.com) (Zero Virtual DOM overhead for 120fps mobile WebView execution)
- **Build Tool:** Vite + TypeScript (Strict Mode)
- **Architecture:** Feature-Sliced Design (FSD)
- **Styling:** Tailwind CSS v4 + Dark Glassmorphism Design Tokens
- **State & Data:** `@tanstack/solid-query` v5
- **Telegram Native SDK:** `@tma.js/sdk-solid` for Haptic Feedback, MainButton, BackButton & Theme integration

### ⚙️ Backend (Go Engine)
- **Language:** Go (Golang) 1.22+
- **Architecture:** Clean Architecture (Handler -> Service -> Repository)
- **Primary Database:** PostgreSQL with `SQLC` for 100% type-safe SQL queries
- **Caching & Pub/Sub:** DragonflyDB (Multi-threaded Redis replacement)
- **Security:** Telegram `initData` HMAC verification + JWT session isolation

---

## ⚡ Quick Start & Development

### Prerequisites
- Node.js 20+ and `pnpm` / `npm`
- Go 1.22+
- Docker & Docker Compose (for local PostgreSQL + DragonflyDB)

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/SeyyedYousef/iFragment.git
cd iFragment
```

### 2. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env
```

### 3. Running Frontend (Dev Server)
```bash
cd frontend
npm install
npm run dev
```
The frontend dev server starts at `http://localhost:3000`.

### 4. Running Backend (Dev Server)
```bash
cd backend
go run cmd/api/main.go
```
The API server starts at `http://localhost:8080`.

---

## 🛠️ Quality Assurance & Validation Scripts

The repository includes automated master validation scripts under `.agent/scripts`:

```bash
# Quick validation during development (Security, Lint, Schema, Tests, UX, SEO)
python .agent/scripts/checklist.py .

# Full verification suite before deployment
python .agent/scripts/verify_all.py . --url http://localhost:3000

# Standalone specialized checkers
python .agent/skills/frontend-design/scripts/ux_audit.py .
python .agent/skills/lint-and-validate/scripts/type_coverage.py .
python .agent/skills/i18n-localization/scripts/i18n_checker.py .
python .agent/skills/nextjs-react-expert/scripts/react_performance_checker.py .
```

---

## 🚢 Production Deployment

For complete step-by-step instructions on deploying with Docker Compose, Cloudflare Pages, SSL, and Telegram Webhooks, see [PRODUCTION.md](PRODUCTION.md).

```bash
# Quick deployment on VPS
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📂 Project Structure

```plaintext
iFragment/
├── .agent/                 # Antigravity Kit (20 Agents, 36 Skills, Validation Scripts)
├── docs/
│   └── decisions/          # Architecture Decision Records (ADRs)
├── frontend/               # SolidJS + Vite App (Feature-Sliced Design)
│   ├── src/
│   │   ├── app/            # Providers, router, global styles
│   │   ├── pages/          # Application views & pages
│   │   ├── widgets/        # Complex composite UI widgets
│   │   ├── features/       # User interaction features
│   │   ├── entities/       # Domain business entities
│   │   └── shared/         # Reusable UI, API, i18n & utilities
├── backend/                # Go Clean Architecture Engine
│   ├── cmd/                # Entrypoints (api, worker)
│   ├── internal/           # Handlers, services, repos, middlewares
│   └── migrations/         # SQL database schema migrations
├── docker-compose.prod.yml # Production Docker orchestration
├── openapi.yaml            # OpenAPI / Swagger Specification
├── PRODUCTION.md           # Production Deployment Guide
└── README.md               # Project Blueprint & Guide
```

---

## 📄 Documentation & References

- [Architecture Decision Record (ADR-001)](docs/decisions/ADR-001-architecture-overview.md)
- [Production Deployment Guide](PRODUCTION.md)
- [Privacy Policy](PRIVACY_POLICY.md)
- [OpenAPI 3.0 Specification](openapi.yaml)
