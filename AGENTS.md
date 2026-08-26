# AGENTS.md — iFragment

Project rules loaded automatically into every Hermes session working in this repo.
Owner: Seyyed Yousef (سید یوسف) — replies should be in Persian (Farsi).

## What this project is
**iFragment** — Telegram Mini App for tracking Fragment (telegram.org username/gift marketplace) auctions and sales.

- **Frontend:** SolidJS + Vite → deployed on Cloudflare Pages
- **Backend:** Go 1.25 in Docker → PostgreSQL 17 + DragonflyDB + Caddy reverse proxy
- **Production VPS:** 109.172.94.139, app root `/opt/ifragment`
- **Repo:** github.com/SeyyedYousef/iFragment
- **Health endpoint:** `/api/v1/healthz/ready` (proves liveness + DB/cache only — it does NOT prove the latest commit is deployed; check drift via git HEAD vs origin/main)

## Hard rules (non-negotiable)
1. **Never SSH into production or touch the VPS unless Seyyed explicitly asks in that very task.** Read-only monitoring jobs he defined are the only exception.
2. Never attach a second polling consumer to the iFragmentBot token — its webhook is active in production (Telegram returns 409 otherwise).
3. DB migrations run automatically at API startup and a failed migration crash-loops the container. Write migrations idempotent (`IF NOT EXISTS`, order-safe). Known incident 2026-08-25: migration 000070 assumed table `sales` existed.
4. Secrets live in `.env` on the VPS / GitHub secrets. Never commit, never print them.
5. Workflow with the owner: read everything first, present a plan, wait for his go-ahead before acting.

## Deployment flow
- Backend: push to `main` → GitHub Actions builds and deploys to the VPS. If CI jobs fail within ~2 seconds of trigger, suspect account/billing state, not code.
- Frontend: Cloudflare Pages builds independently on every push.
- After any deploy question: verify running version on the VPS via git (needs rule-1 permission), never trust the health endpoint alone.

## Local development
```bash
docker compose up      # local stack
go test ./...          # backend tests (backend/)
npm run dev            # frontend dev server (frontend/)
```

## Context map
- Full architecture notes + Fragment domain docs (usernames, auctions, fees, Gifts, Stars/XTR, initData HMAC) live in the Hermes skill `ifragment-architecture` — load it before deep work instead of re-reading the codebase.
