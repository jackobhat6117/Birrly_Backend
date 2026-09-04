# Birrly — Backend API

Express + TypeScript modular monolith. Clients use REST APIs; Telegram can also parse natural language into structured commands. The LLM never writes to the database.

PostgreSQL is the source of truth for money.

## Stack

- Node.js 20
- Express
- TypeScript
- Prisma + PostgreSQL
- Redis + BullMQ
- Zod
- Decimal.js

## Quick start

From `Birrly/`:

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

`npx prisma db seed` writes **system categories only**. Fake users for QA live on the `oat-env` branch:

```bash
ALLOW_DEMO_SEED=true npm run prisma:seed:demo
```

Do not run the demo seed against production / `main`.
`npx prisma db seed` writes **system categories only**. Do not load fake users on `main` or production. QA demo people live on the `oat-env` branch.

Worker (reminders/notifications):

```bash
npm run dev:worker
```

## Layout

```text
src/
  app/              HTTP bootstrap, config, DI container, routes
  modules/          domain modules (controller → service → repository)
  integrations/     Telegram, LLM, and payments adapters
  jobs/             BullMQ workers
  middleware/
  database/
  shared/           errors, money, i18n, logger
```

## Auth

API routes under `/api/v1` expect Telegram Mini App init data:

- `x-telegram-init-data: <initData>`
- or `Authorization: tma <initData>`

For local testing only, set `DEV_AUTH_ENABLED=true` and send `x-dev-telegram-id`. This is rejected in production.

## Useful endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process alive |
| GET | `/ready` | Postgres + Redis |
| POST | `/webhooks/telegram` | Bot webhook |
| GET | `/api/v1/dashboard` | Monthly snapshot |
| CRUD | `/api/v1/transactions` | Expenses / income |
| CRUD | `/api/v1/debts` | Debts and payments |
| POST | `/api/v1/reminders` | Reminders |

Amounts in JSON are strings, e.g. `"350.00"`.

Natural-language bot messages are parsed into structured commands, validated, then confirmed before a domain service writes to PostgreSQL. Set `LLM_API_KEY` in `.env` (Gemini) for Premium LLM parsing; without a key, the rule-based fallback parser is used.

## Production (single VPS)

See **[DEPLOY.md](./DEPLOY.md)** for Contabo/Hetzner-style deployment with one Compose file:

```bash
cp .env.production.example .env
docker compose -f docker-compose.prod.yml --profile ssl up -d --build
```

