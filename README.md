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

`npx prisma db seed` writes **system categories only**. OAT demo users live in a **separate database** on `APP_PROFILE=oat` — see [OAT / mock database](#oat--mock-database) below.

Do not run the demo seed against production (`APP_PROFILE=production` on `main`).

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

For local testing only, set `DEV_AUTH_ENABLED=true` and send `x-dev-telegram-id`. On production (`APP_PROFILE=production`) this is blocked. On OAT (`APP_PROFILE=oat`) dev auth is allowed for QA.

## OAT / mock database

Production and OAT use the **same code**; separation is env-only:

| | Production (`main`) | OAT (`oat-env`) |
|---|---|---|
| `APP_PROFILE` | `production` | `oat` |
| Database | `pfa` | `pfa_oat` (isolated volume) |
| Demo users | No | `@oat_amina`, `@oat_dawit` |
| Test API | Disabled | `/api/v1/test/*` |
| Dev auth header | Off | On |

```bash
cp .env.oat.example .env
docker compose -f docker-compose.oat.yml up -d --build
curl http://localhost:3003/api/v1/test/status
```

Reset demo ledger:

```bash
curl -X POST http://localhost:3003/api/v1/test/reset-demo \
  -H "x-test-secret: $TEST_API_SECRET"
```

Point the mini-app at the OAT API with `VITE_USE_MOCK=false` and `VITE_DEV_TELEGRAM_ID=oat-900001`.

## Useful endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process alive |
| GET | `/ready` | Postgres + Redis |
| GET | `/api/v1/test/status` | OAT only — profile + demo users |
| POST | `/api/v1/test/reset-demo` | OAT only — reload demo seed (`x-test-secret`) |
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

