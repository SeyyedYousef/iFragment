# iFragment Production Deployment Guide

This document outlines the steps to deploy iFragment in a production environment.

## Prerequisites
- Docker & Docker Compose
- Domain name with SSL (using Cloudflare for DNS + SSL)
- Telegram Bot Token (from @BotFather)
- VPS with at least 2 CPU cores and 4GB RAM

## Environment Variables
Create a `.env` file in the **root directory** (next to `docker-compose.prod.yml`) based on `.env.example`.

### Critical Variables (Server will NOT start without these):
- `APP_ENV=production`
- `JWT_SECRET`: A 32+ character random string (generate with `openssl rand -hex 32`)
- `WEBHOOK_SECRET_TOKEN`: A random string for Telegram webhook verification
- `BOT_TOKEN`: Official bot token from @BotFather
- `TELEGRAM_BOT_TOKEN`: Same value as BOT_TOKEN (used by marketplace/clan/gamification services)
- `DATABASE_URL`: Auto-configured by docker-compose, no need to set manually
- `DRAGONFLY_URL`: Auto-configured by docker-compose, no need to set manually

### Database (Used by docker-compose):
- `POSTGRES_USER`: Database username (default: `user`)
- `POSTGRES_PASSWORD`: Database password (**change this!**)
- `POSTGRES_DB`: Database name (default: `ifragment`)

### CORS & App URL:
- `ALLOWED_ORIGINS`: Your frontend domain (e.g., `https://tgfirewall.xyz`)
- `APP_URL`: Your backend URL (e.g., `https://api.tgfirewall.xyz`)

### Optional:
- `TONAPI_KEY`: For TON blockchain integration
- `SENTRY_DSN`: For error tracking
- `METRICS_TOKEN`: Bearer token to protect `/metrics` endpoint
- `OWNER_TELEGRAM_IDS`: Comma-separated Telegram IDs for admin panel access
- `OWNER_TOTP_SECRET`: TOTP secret for admin 2FA authentication

## Deployment Steps

### 1. Prepare Environment
```bash
# Clone or upload project to server
cd /opt/ifragment

# Copy and edit environment file
cp .env.example .env
nano .env  # Fill in ALL required values
```

### 2. Build and Start Services
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This single command will:
- Build the Go API from source
- Start PostgreSQL with persistent storage
- Start DragonflyDB for caching
- Automatically run database migrations
- Start the API server on port 8080

### 3. Verify Deployment
```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl http://localhost:8080/api/v1/health

# Check readiness (DB + Cache connected)
curl http://localhost:8080/api/v1/healthz/ready

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
```

### 4. Frontend Deployment (Cloudflare Pages)
The frontend is a SPA deployed separately on Cloudflare Pages:
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: `frontend`
- Environment variable: `VITE_API_URL=https://api.tgfirewall.xyz/api/v1`

## Security Recommendations
1. **DB Backups**: Schedule regular backups of the `pgdata` volume.
2. **Firewall**: Only expose ports 80/443 via reverse proxy. Keep DB and DragonflyDB internal only.
3. **Secrets**: Keep all secrets in `.env` file with restricted permissions (`chmod 600 .env`).
4. **Updates**: Regularly update Docker images for security patches.

## Scaling
- The API is stateless and can be scaled horizontally by adding more containers.
- DragonflyDB is multi-threaded and benefits from additional CPU cores.
- PostgreSQL can be scaled with read replicas if needed.
