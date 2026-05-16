# iFragment Production Deployment Guide

This document outlines the steps to deploy iFragment in a production environment.

## Prerequisites
- Docker & Docker Compose
- Domain name with SSL (recommended: Nginx Proxy Manager or Traefik)
- Telegram App ID & Hash
- OpenAI/Gemini API Keys

## Environment Variables
Create a `.env` file in the root directory based on `.env.example`.

### Critical Variables:
- `APP_ENV=production`
- `DATABASE_URL`: PostgreSQL connection string
- `DRAGONFLY_ADDR`: Dragonfly DB address (e.g., `dragonfly:6379`)
- `TG_APP_ID`: From my.telegram.org
- `TG_APP_HASH`: From my.telegram.org
- `BOT_TOKEN`: Official bot token from @BotFather
- `AI_KEYS_MASTER_KEY`: A 32-character string for AES encryption of user AI keys.

## Deployment Steps

### 1. Build and Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 2. Frontend Build
The frontend is a SPA. Build it and serve the `dist` folder via Nginx.
```bash
cd frontend
npm install
npm run build
```

### 3. Monitoring
- **Prometheus**: Metrics are available at `/metrics`.
- **Sentry**: Configure `SENTRY_DSN` for error tracking.
- **Logs**: Use `docker logs ifragment-api-1` for structured JSON logs.

## Security Recommendations
1.  **DB Backups**: Schedule regular backups of the `pgdata` volume.
2.  **Firewall**: Only expose ports 80/443 and keep DB/Redis internal.
3.  **Master Key**: Keep `AI_KEYS_MASTER_KEY` extremely secure. If lost, all user AI keys become unrecoverable.

## Scaling
- The API is stateless and can be scaled horizontally.
- `Asynq` workers can be scaled independently by running more instances of the backend with the worker flag (if implemented) or just more containers.
