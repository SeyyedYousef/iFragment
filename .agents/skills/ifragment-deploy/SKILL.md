---
name: ifragment-deploy
description: One-command automated deployment and live update of iFragment to the production VPS (109.172.94.139). Handles local verification, git synchronization, SSH connection, Docker Compose rebuild, and live health verification. Use whenever the user asks to deploy, update the server, or run on VPS ("اپدیت سرور", "در سرور اپدیت کن", "دیپلوی", "/deploy", "deploy to server").
---

# iFragment Production Deployment Skill (`ifragment-deploy`)

This skill automates the end-to-end deployment of **iFragment** to the production VPS (`109.172.94.139`).

---

## 🎯 When to Use

Invoke this skill whenever:
- The user requests to deploy to the server ("اپدیت سرور", "پروژه رو روی سرور دیپلوی کن", "روی سرور آپدیت کن", "/deploy").
- Code changes have been tested locally and need to be deployed to production.
- Restarting or verifying containers on the production VPS.

---

## ⚙️ Server Configuration

- **VPS IP:** `109.172.94.139` (Aeza Frankfurt, Germany)
- **App Directory:** `/opt/ifragment`
- **Docker Compose:** `/opt/ifragment/docker-compose.prod.yml`
- **Public Domain:** `https://109-172-94-139.sslip.io`
- **Reverse Proxy:** Caddy HTTPS on port 80/443 proxying to `localhost:8080`
- **Health Endpoint:** `https://109-172-94-139.sslip.io/api/v1/healthz/ready`

---

## 🚀 Execution Workflow

### Step 1: Local Pre-Flight Verification
Before deploying, make sure the local code compiles:
```bash
# In backend/
go test ./...

# In frontend/
npx tsc --noEmit
```

### Step 2: Push Changes to GitHub
Commit any outstanding changes and push to `origin main`:
```bash
git add .
git commit -m "feat/fix: <description>"
git push origin main
```

### Step 3: Run Automated Deployment Script
Execute the bundled Python deployment script from the project root:
```bash
python .agent/skills/ifragment-deploy/scripts/deploy_vps.py
```

Options:
- `--skip-git-pull`: Skips pulling from GitHub on the VPS (useful if testing VPS-local edits).
- `--restart-only`: Restarts the `api` container without rebuilding the Docker image (for fast env or config reloads).

### Step 4: Verification & Live Health Check
The script automatically queries:
`curl -s https://109-172-94-139.sslip.io/api/v1/healthz/ready`
Expected JSON output:
```json
{"status": "ready"}
```

---

## 🛡️ Hard Rules & Safeguards

1. **`ALLOW_MOCK_CLIENT=true` Safeguard:** Always ensure `ALLOW_MOCK_CLIENT=true` is set in `/opt/ifragment/.env` so that temporary Telegram MTProto session disconnects do not trigger an API container crash loop.
2. **Idempotent DB Migrations:** Database migrations run automatically on container startup (`/app/migrations`). Never write non-idempotent DDL.
3. **No Duplicate Telegram Bot Pollers:** The production Telegram webhook is registered to the Caddy URL. Never start a local polling bot with the production bot token.
