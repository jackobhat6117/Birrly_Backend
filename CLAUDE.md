# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Birrly — an Ethiopian Telegram personal finance assistant. Express + TypeScript modular monolith. Users interact via a Telegram bot (rule-based free-tier parsing, e.g. `80 taxi`, `Abebe 2000`) and a Telegram Mini App. Premium unlocks LLM natural-language parsing (Gemini), budgets, savings goals, and reports. PostgreSQL is the source of truth for money; the LLM never writes to the database — it only produces a structured command that domain services execute.

For any architectural decision, read `PROJECT_ARCHITECTURE.md` first — it is the authoritative spec (`.cursor/rules/architecture.mdc` enforces this). This file summarizes what you need day-to-day; the full doc has the reasoning.

## Commands

Run from `Birrly/`:

```bash
npm run dev              # API server (tsx watch)
npm run dev:worker       # BullMQ worker (reminders/notifications)
npm run build             # tsc + tsc-alias -> dist/
npm run typecheck         # tsc --noEmit
npm run lint               # eslint .
npm test                   # vitest run
npm run test:watch         # vitest watch
npx vitest run tests/unit/debt.service.test.ts   # single test file
npx vitest run -t "some test name"                # by test name
```

Database (Prisma):

```bash
npx prisma migrate dev      # create + apply a migration in dev
npx prisma migrate deploy   # apply migrations (prod/OAT)
npx prisma generate
npx prisma studio
npm run prisma:seed         # system categories only — safe everywhere
npm run prisma:seed:demo    # demo users — OAT only, never against production
```

First-time setup and OAT/mock-database details are in [README.md](README.md); production deployment (single VPS, Contabo/Hetzner) is in [DEPLOY.md](DEPLOY.md).

## Architecture

### Request flow

```
Controller -> Service -> Repository -> Prisma -> PostgreSQL
```

- **Controllers** (`*.controller.ts`): HTTP in/out, auth context, calling services. No business logic, no direct DB/Prisma access.
- **Services** (`*.service.ts`): business rules, workflows, transaction orchestration. No Telegram-specific formatting, no direct HTTP parsing.
- **Repositories** (`*.repository.ts`): Prisma queries and persistence only. No business decisions, no sending Telegram messages, no subscription checks.

Wiring happens in [src/app/container.ts](src/app/container.ts) (manual DI — repository -> service -> controller per module) and [src/app/routes.ts](src/app/routes.ts) (mounts each module's routes under `/api/v1`, gated by `container`-provided controllers). Feature flags can gate a route's mount entirely (e.g. `equb` routes only mount when `config.features.equbEnabled`).

### Module layout

Each domain lives under `src/modules/<name>/` with `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.routes.ts` (not every module has all of these — e.g. read-only or admin modules may skip a repository). Current modules: `users`, `accounts`, `transactions`, `debts`, `categories`, `budgets`, `savings`, `reminders`, `reports`, `notifications`, `subscriptions`, `analytics`, `admin`, `audit`, `feedback`, `equb` (rotating savings — built but hidden behind `EQUB_ENABLED`), `ai`, `coach` (premium AI Money Coach — cash-flow/leaks/audit lenses over the user's own numbers), `test` (OAT-only test/reset endpoints).

External SDKs stay isolated in `src/integrations/` (`telegram/`, `llm/`, `payments/`) — never called directly from domain services. The dependency direction is Telegram/HTTP handler -> domain service -> domain result -> back out through the integration adapter, never the reverse (domain services must not know Telegram message formatting).

`src/jobs/` holds BullMQ workers (reminders, notifications) run via `npm run dev:worker` / `start:worker`, separate from the API process.

### AI parsing

Free tier: rule-based parser only. Premium (`FEATURE.AI_NATURAL_LANGUAGE`): Gemini LLM parsing (`AiParseService` / `AiInterpreter` in `src/modules/ai/`), with the rule-based parser as fallback when the LLM fails or the free daily quota (`AI_RATE_LIMIT_MAX`) is exhausted. Both paths produce the same `StructuredCommand` shape that domain services execute — the AI layer never touches Prisma. Prompts under `src/modules/ai/prompts/` should be versioned (e.g. `*.v1.ts`) if changed materially.

### Auth

- `/api/v1/*` routes expect Telegram Mini App init data via `x-telegram-init-data` or `Authorization: tma <initData>` (`src/middleware/auth.ts`).
- Local/OAT-only dev auth: `DEV_AUTH_ENABLED=true` + `x-dev-telegram-id` header — blocked when `APP_PROFILE=production`.
- Admin dashboard uses a separate JWT auth (`src/middleware/admin-auth.ts`, `ADMIN_JWT_SECRET`).
- Never trust a client-supplied user ID; every query must be scoped to the authenticated user (tenant isolation).

### Money & financial integrity

- Never use JS floating-point numbers for money — use `Decimal` (`decimal.js`) via `src/shared/utils/money.ts`. Amounts are serialized as strings in API JSON (e.g. `"350.00"`).
- Multi-write financial operations (e.g. debt payment + debt balance update) must be atomic — wrap in a Prisma transaction.
- Telegram webhook processing must be idempotent (dedupe by `telegram_update_id`) — see `src/integrations/telegram/telegram-idempotency.store.ts`.
- Currency is ETB by default but should flow as config/domain data, not be hard-coded through business logic.
- Financial state changes should produce audit records (`src/modules/audit/`) — e.g. `TRANSACTION_CREATED`, `DEBT_PAYMENT_CREATED`, `SUBSCRIPTION_STARTED`.

### Environments

Production and OAT (QA) run the **same code**; separation is env-only via `APP_PROFILE` (`production` vs `oat`) plus per-profile `.env` files (`.env.production.example`, `.env.oat.example`). OAT has isolated DB/port, demo seed users, dev auth enabled, and `/api/v1/test/*` endpoints — none of that exists on `APP_PROFILE=production`. Never run `prisma:seed:demo` or point demo tooling at production.

## Non-negotiables (from `.cursor/rules/architecture.mdc`)

- Controllers stay thin; business rules live in services; DB access lives in repositories only.
- AI only returns structured commands — it never writes to the database.
- Free chat uses the rule-based parser; LLM parsing is Premium-gated.
- Never trust client-supplied user IDs — scope every query by the authenticated user.
- Never use JS numbers for money — use the Decimal helpers.
- Financial multi-write operations must be atomic.
- Telegram/LLM/payment SDKs stay under `integrations/`, not in domain services.
- Don't add microservices, bank sync, or new Mini App work unless asked.
