# Deploy Birrly on one VPS (Docker Compose)

Run the full stack on a single server:

```text
Caddy (HTTPS, optional) → API (Express) → PostgreSQL
                              ↓
                           Worker (BullMQ)
                              ↓
                            Redis
```

## 1. Prepare the VPS

Ubuntu 22.04+ or Debian 12+ recommended.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in so docker group applies
```

Open firewall ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# only if testing without Caddy:
# sudo ufw allow 3000/tcp
sudo ufw enable
```

## 2. Clone and configure

```bash
git clone <your-repo-url> birrly
cd birrly/Birrly   # or cd birrly if repo root is Birrly

cp .env.production.example .env
nano .env
```

Set at minimum:

| Variable | Example |
|---|---|
| `POSTGRES_PASSWORD` | long random password |
| `DOMAIN` | `api.yourdomain.com` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | long random string |
| `TELEGRAM_WEBHOOK_URL` | `https://api.yourdomain.com/webhooks/telegram` |
| `TELEGRAM_MINI_APP_URL` | `https://birrly.com/mini-app/` |
| `CORS_ORIGIN` | `https://birrly.com,https://app.birrly.com` |
| `ADMIN_JWT_SECRET` | long random string |
| `ADMIN_BOOTSTRAP_EMAIL` | your admin email |
| `ADMIN_BOOTSTRAP_PASSWORD` | strong password |
| `RUN_DB_SEED` | `true` on first deploy only |

Point your domain **A record** to the VPS public IP before using HTTPS.

Generate secrets:

```bash
openssl rand -hex 32
```

## 3. Build and start

**With HTTPS (recommended for Telegram):**

```bash
docker compose -f docker-compose.prod.yml --profile ssl up -d --build
```

**Without Caddy (testing only — HTTP on port 3000):**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api worker
```

Health:

```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/ready
# with Caddy + domain:
curl -fsS https://api.yourdomain.com/health
```

## 4. Seed categories (first deploy)

If you did not set `RUN_DB_SEED=true` in `.env`:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

Then set `RUN_DB_SEED=false` in `.env` for future restarts.

## 5. Telegram bot (webhook + menu button)

On API startup, Birrly registers the webhook, **command menu**, bot profile text, and menu button when these are set in `.env`:

- `TELEGRAM_WEBHOOK_URL` + `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MINI_APP_URL` (HTTPS Mini App URL)

Registered commands: `/start`, `/dashboard`, `/help`, `/feedback` (English + Amharic descriptions).

Check API logs for `Telegram webhook registered` and `Telegram bot commands and profile text registered`.

Manual registration (if needed):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://api.yourdomain.com/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verify:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## 6. Update after code changes

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically when the API container starts.

## 7. Useful commands

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker

# Restart one service
docker compose -f docker-compose.prod.yml restart worker

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and DELETE database volumes (destructive)
docker compose -f docker-compose.prod.yml down -v
```

## 8. Backups (important)

Postgres data lives in Docker volume `pfa_pgdata`. Back up regularly:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U pfa pfa > backup-$(date +%F).sql
```

## Local dev vs production compose

| File | Purpose |
|---|---|
| `docker-compose.yml` | Dev only — Postgres + Redis on localhost |
| `docker-compose.prod.yml` | Full VPS stack — API + worker + Postgres + Redis (+ optional Caddy) |

## Troubleshooting

| Problem | Check |
|---|---|
| API won't start | `docker compose ... logs api` — often bad `.env` or migration error |
| `/ready` fails | Postgres or Redis not healthy: `docker compose ... ps` |
| Telegram webhook fails | HTTPS required; `DOMAIN` DNS must point to VPS; ports 80/443 open |
| Reminders not sent | Worker running? `docker compose ... logs worker` |
| `ADMIN_JWT_SECRET` error | Must not be the dev default in production |
