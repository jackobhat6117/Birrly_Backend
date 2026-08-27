# PROJECT ARCHITECTURE

## Ethiopian Telegram Personal Finance Assistant

**Document Status:** Authoritative
**Version:** 1.1
**Architecture Style:** Modular Monolith
**Primary Platform:** Telegram Bot + Telegram Mini App
**Primary Currency:** ETB
**Target Initial Scale:** 1,000–5,000 users

---

# 1. Purpose of This Document

This document is the architectural source of truth for the project.

All development decisions must follow the principles, boundaries, conventions, and constraints defined here.

When implementing a new feature, the developer or AI coding assistant must:

1. Read this document before making architectural changes.
2. Reuse existing modules and abstractions where possible.
3. Avoid introducing new infrastructure without a strong reason.
4. Avoid creating unnecessary microservices.
5. Keep business logic inside domain/application modules.
6. Keep financial data authoritative in PostgreSQL.
7. Never allow AI/LLM output to directly modify the database.
8. Maintain strict user-level data isolation.
9. Preserve backward compatibility unless a deliberate migration is created.
10. Update this document when an architectural decision materially changes.

---

# 2. Product Overview

The product is an Ethiopian personal finance assistant that primarily lives inside Telegram.

Users can interact with the system conversationally.

Free (rule-based, no LLM):

> 80 taxi

> Abebe 2000

> 40000 salary

Premium (LLM, with rule-based fallback):

> I spent 350 birr on lunch.

> Abebe owes me 2,000 birr.

> Remind me to pay rent on the 1st.

> How much did I spend on food this month?

The system provides:

* Expense tracking (unlimited on Free)
* Income tracking
* Debt tracking (unlimited IOUs + Telegram nudge)
* Payday countdown (calendar only)
* Rule-based Telegram logging on Free (`80 taxi`, `Abebe 2000`)
* Reminders (5 on Free with bill templates; unlimited on Premium)
* Budgets (Premium)
* Savings goals (Premium)
* Monthly reports vs last month (Premium)
* LLM natural-language chat (Premium)
* Telegram notifications
* Premium subscription functionality

The Telegram Bot is the conversational interface.

The Telegram Mini App is the visual interface.

The backend is the actual product and must remain independent of Telegram-specific UI logic.

---

# 3. Product Principles

## 3.1 Simplicity First

The product should feel like talking to a financial assistant rather than using accounting software.

The user should not be forced to understand:

* Accounting terminology
* Complex financial workflows
* Database concepts
* Technical concepts

Prefer:

> "I spent 500 birr on food."

over:

> Open transaction → select account → select category → select date → enter amount → submit.

---

## 3.2 Telegram First

Telegram is the initial distribution and interaction layer.

However:

**Telegram must not become the domain architecture.**

The business logic must live in the backend.

This allows future clients:

* Web application
* iOS application
* Android application

to use the same backend.

---

## 3.3 Financial Data Is Critical

Financial records must be treated as high-integrity data.

Never:

* Use floating point for monetary calculations.
* Trust client-supplied user IDs.
* Allow LLMs direct database access.
* Delete financial records without authorization.
* Mix users' financial data.
* Store sensitive financial data unnecessarily in logs.

---

## 3.4 AI Is an Interpreter

AI is not the source of truth.

Free uses the rule-based parser only. Premium may use the LLM (`FEATURE.AI_NATURAL_LANGUAGE`). Both produce the same `StructuredCommand`. Domain services execute it.

Correct architecture:

```text
Natural Language
        ↓
AI Parser (rule-based and/or LLM)
        ↓
Structured Command
        ↓
Validation
        ↓
Business Rules
        ↓
Domain Service
        ↓
Database
```

Incorrect architecture:

```text
Natural Language
        ↓
LLM
        ↓
Database
```

---

# 4. Architecture Decision

## 4.1 Architecture Style

Use a:

**Modular Monolith**

Do NOT use microservices for the initial implementation.

The backend is one deployable application but contains strongly separated business modules.

Example:

```text
Backend
│
├── Users
├── Transactions
├── Accounts
├── Debts
├── Budgets
├── Savings
├── Reminders
├── Reports
├── Notifications
├── Subscriptions
└── AI
```

Each module must have clear responsibilities.

---

# 5. Why Modular Monolith

The initial target is approximately:

* 1,000 users
* 3,000 users
* 5,000 users

Potentially later:

* 50,000+
* 100,000+

Microservices are not justified initially.

Microservices would introduce:

* Distributed transactions
* Service discovery
* More deployment complexity
* More monitoring
* More networking
* More failure scenarios
* Higher infrastructure cost
* Slower development

The modular monolith provides:

* Simple development
* Simple deployment
* Strong module boundaries
* Easy testing
* Low infrastructure cost
* Future extraction capability

---

# 6. Future Scaling Strategy

If the product grows significantly, individual modules may be extracted.

Potential future services:

```text
AI Service
Notification Service
Reporting Service
Payment Service
```

Do not extract services prematurely.

The initial goal is:

```text
Modular Monolith
        ↓
Scale vertically/horizontally
        ↓
Identify actual bottlenecks
        ↓
Extract only necessary modules
```

---

# 7. High-Level Architecture

```text
                         TELEGRAM
                    ┌─────────────────┐
                    │                 │
                    │ Bot  Mini App   │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │ Backend API      │
                   │                  │
                   │ Authentication   │
                   │ Validation       │
                   │ Controllers      │
                   └────────┬─────────┘
                            │
                            ▼
              ┌────────────────────────────┐
              │ Application / Domain       │
              │                            │
              │ Users                      │
              │ Transactions               │
              │ Accounts                   │
              │ Debts                      │
              │ Budgets                    │
              │ Savings                    │
              │ Reminders                  │
              │ Reports                    │
              │ Notifications              │
              │ Subscriptions              │
              │ AI                         │
              └────────────┬───────────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       PostgreSQL        Redis         Workers
                                     
             │             │             │
             └─────────────┼─────────────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
              Telegram     LLM      Payment
                API      Provider    Provider
```

---

# 8. Technology Stack

## Frontend

Use:

* React
* TypeScript
* Telegram Mini App SDK
* Vite or Next.js depending on project requirements

Prefer TypeScript everywhere.

---

## Backend

Use:

* Node.js
* TypeScript
* REST API
* Zod for validation
* Prisma or Drizzle ORM

Do not introduce another backend language unless there is a strong architectural reason.

---

## Database

Primary database:

**PostgreSQL**

PostgreSQL is the authoritative source of truth for:

* Users
* Transactions
* Accounts
* Debts
* Budgets
* Savings
* Reminders
* Subscriptions
* Payments
* Audit logs

---

## Cache / Queue

Use:

**Redis**

Use Redis for:

* Background job queues
* Rate limiting
* Temporary conversation state
* Caching where justified

Do NOT use Redis as the permanent source of financial data.

---

## Background Processing

Use:

**BullMQ + Redis**

Workers handle:

* Reminders
* Notifications
* Monthly reports
* Recurring transactions
* AI insight generation
* Subscription checks
* Cleanup tasks

---

# 9. Repository Structure

Recommended structure:

```text
project/
│
├── apps/
│   │
│   ├── backend/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── mini-app/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   ├── shared/
│   ├── types/
│   └── config/
│
├── infrastructure/
│   ├── docker/
│   ├── deployment/
│   └── scripts/
│
├── docs/
│
├── .cursor/
│   └── rules/
│
├── PROJECT_ARCHITECTURE.md
├── package.json
├── docker-compose.yml
└── README.md
```

A monorepo is recommended.

---

# 10. Backend Structure

Backend should be organized by domain.

```text
apps/backend/src/

├── app/
│   ├── app.ts
│   ├── config.ts
│   └── routes.ts
│
├── modules/
│
│   ├── users/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.schema.ts
│   │   ├── user.types.ts
│   │   └── user.routes.ts
│   │
│   ├── transactions/
│   │   ├── transaction.controller.ts
│   │   ├── transaction.service.ts
│   │   ├── transaction.repository.ts
│   │   ├── transaction.schema.ts
│   │   ├── transaction.types.ts
│   │   └── transaction.routes.ts
│   │
│   ├── accounts/
│   ├── debts/
│   ├── budgets/
│   ├── savings/
│   ├── reminders/
│   ├── reports/
│   ├── notifications/
│   ├── subscriptions/
│   └── ai/
│
├── integrations/
│   ├── telegram/
│   ├── llm/
│   └── payments/
│
├── jobs/
│   ├── reminder.job.ts
│   ├── notification.job.ts
│   ├── report.job.ts
│   └── recurring-transaction.job.ts
│
├── middleware/
│   ├── auth.ts
│   ├── error-handler.ts
│   ├── rate-limit.ts
│   └── request-id.ts
│
├── database/
│   ├── prisma/
│   └── migrations/
│
└── shared/
    ├── errors/
    ├── utils/
    ├── constants/
    ├── logger/
    └── types/
```

---

# 11. Module Architecture

Every business module should generally follow:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

## Controller

Responsible for:

* HTTP input
* Authentication context
* Request validation
* Calling services
* Returning responses

Controllers must NOT contain business logic.

---

## Service

Responsible for:

* Business rules
* Domain workflows
* Authorization checks where appropriate
* Transaction orchestration

Example:

```text
TransactionService.createExpense()
```

---

## Repository

Responsible for:

* Database access
* Queries
* Persistence

Repositories must NOT contain business decisions.

---

# 12. Dependency Direction

Preferred:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↓
Infrastructure
```

Do not allow:

```text
Controller → PostgreSQL directly
Controller → Prisma directly
AI → PostgreSQL directly
```

---

# 13. Core Modules

## 13.1 Users

Responsibilities:

* User creation
* Telegram identity
* Profile
* Language
* Currency
* Timezone
* Preferences

---

## 13.2 Accounts

Represents where money is tracked.

Examples:

* Cash
* Bank
* Telebirr
* M-Pesa
* Card
* Other

Initially these are manually tracked.

Do not implement direct banking integration unless explicitly required later.

---

## 13.3 Transactions

Core financial module.

Supports:

* Expense
* Income
* Transaction history
* Categories
* Payment methods
* Search
* Filtering
* Editing
* Deletion

Example:

```text
Transaction
├── id
├── userId
├── accountId
├── categoryId
├── type
├── amount
├── currency
├── description
├── transactionDate
├── createdAt
└── updatedAt
```

---

## 13.4 Debts

Supports:

* Someone owes the user
* User owes someone
* Debt amount
* Debt payment
* Remaining amount
* Debt history
* Debt reminders

Example:

```text
Debt
├── id
├── userId
├── personName
├── type
├── originalAmount
├── remainingAmount
├── currency
├── dueDate
├── status
└── createdAt
```

---

## 13.5 Budgets

Supports:

* Category budgets
* Monthly budgets
* Weekly budgets
* Budget progress
* Budget alerts

Example:

```text
Food budget
8,000 ETB

Spent
6,200 ETB

Remaining
1,800 ETB
```

---

## 13.6 Savings

Supports:

* Savings goals
* Target amount
* Current amount
* Contributions
* Progress

Example:

```text
Goal:
New Phone

Target:
100,000 ETB

Current:
25,000 ETB
```

---

## 13.7 Reminders

Supports:

* One-time reminders
* Daily reminders
* Weekly reminders
* Monthly reminders
* Custom recurring reminders

Examples:

* Rent
* Electricity
* Internet
* Debt collection
* Savings

---

## 13.8 Reports

Responsible for:

* Monthly summaries
* Category spending
* Income
* Expenses
* Savings rate
* Spending trends

---

## 13.9 Notifications

Responsible for:

* Telegram messages
* Reminder notifications
* Budget alerts
* Monthly reports
* Subscription notifications

Notification delivery should be asynchronous.

---

## 13.10 Subscriptions

Responsible for:

* Free plan
* Premium plan
* Subscription lifecycle
* Feature entitlements
* Payment status

Do not scatter subscription checks throughout unrelated modules.

Use:

```text
SubscriptionService
```

and feature entitlement checks.

---

## 13.11 AI

Responsible only for:

* Intent detection
* Natural-language parsing
* Entity extraction
* Query interpretation
* Financial insight generation

AI must not directly access repositories.

The rule-based fallback parser is part of the Free plan. The LLM provider is Premium (`FEATURE.AI_NATURAL_LANGUAGE`). Both produce the same `StructuredCommand`. Domain services execute the command. The LLM never writes to the database.

---

# 14. Database Architecture

Primary entities:

```text
users                  (payday_day optional, 1–31)
accounts
categories
transactions
debts
debt_payments
budgets
savings_goals
savings_contributions
reminders
recurring_transactions
subscriptions
payments
notifications
ai_interactions
audit_logs
```

---

# 15. Entity Relationships

```text
User
│
├── Accounts
│
├── Transactions
│      ├── Category
│      └── Account
│
├── Debts
│      └── Debt Payments
│
├── Budgets
│      └── Category
│
├── Savings Goals
│      └── Contributions
│
├── Reminders
│
├── Notifications
│
└── Subscription
```

Every user-owned entity must contain a reliable ownership relationship to the user.

---

# 16. Tenant Isolation

The application is logically multi-tenant.

Every user must only access their own data.

Every user-owned database query must enforce ownership.

Example:

```sql
SELECT *
FROM transactions
WHERE id = $1
AND user_id = $currentUserId;
```

Never:

```sql
SELECT *
FROM transactions
WHERE id = $1;
```

unless ownership has already been safely enforced by another layer.

---

# 17. Money Handling

Never use JavaScript floating-point numbers for financial calculations.

Bad:

```ts
const amount = 350.25;
```

Use fixed-precision Decimal handling.

For example:

```ts
Decimal
```

or an integer minor-unit strategy where appropriate.

The chosen monetary representation must be consistent throughout the system.

---

# 18. Currency

Initial currency:

```text
ETB
```

Default timezone:

```text
Africa/Addis_Ababa
```

Do not hard-code ETB throughout business logic.

Use:

```text
currency = ETB
```

as configuration/domain data.

This keeps future multi-currency support possible.

---

# 19. Transaction Integrity

Financial operations should be atomic.

For example, recording a debt payment may require:

```text
Create payment
        +
Update debt remaining amount
```

These operations should happen inside a database transaction.

If one fails:

```text
ROLLBACK
```

No partial financial state should remain.

---

# 20. Idempotency

Financial operations must avoid accidental duplication.

Example:

Telegram retries the same webhook.

The backend must not create two transactions.

Use an idempotency key or Telegram update ID where appropriate.

Example:

```text
telegram_update_id
```

must be processed safely.

---

# 21. Audit Logging

Financial state changes should generate audit records.

Examples:

```text
TRANSACTION_CREATED
TRANSACTION_UPDATED
TRANSACTION_DELETED
DEBT_CREATED
DEBT_PAYMENT_CREATED
SUBSCRIPTION_STARTED
SUBSCRIPTION_CANCELLED
```

Audit logs should contain enough information to reconstruct important events without storing unnecessary sensitive data.

---

# 22. Telegram Bot Architecture

Telegram communicates with the backend through webhook updates.

```text
Telegram
    ↓
POST /webhooks/telegram
    ↓
TelegramUpdateHandler
    ↓
Update Router
```

Supported update types:

* Text messages
* Commands
* Inline button callbacks
* Mini App events

---

# 23. Telegram Bot Responsibilities

The bot handles:

* Quick financial entries
* Natural-language interaction
* Confirmation
* Commands
* Notifications
* Reminders

Example:

```text
User:
I spent 350 birr on lunch.

Bot:
💸 Record 350 ETB for Food?

[Confirm] [Edit] [Cancel]
```

---

# 24. Telegram Mini App Responsibilities

The Mini App handles:

* Dashboard
* Transactions
* Charts
* Budgets
* Debts
* Savings
* Reports
* Settings
* Subscription management

Do not duplicate complex business logic in the Mini App.

The backend remains authoritative.

---

# 25. Mini App Authentication

The Mini App must send Telegram initialization data.

Backend must verify Telegram authentication data before establishing the user identity.

Never trust:

```text
userId
```

provided directly by the browser.

After verification:

```text
Telegram identity
        ↓
Backend user
        ↓
Application session
```

---

# 26. AI Architecture

AI processing must follow:

```text
User Message
      ↓
Intent Detection
      ↓
Entity Extraction
      ↓
Structured Command
      ↓
Schema Validation
      ↓
Business Validation
      ↓
Confirmation if required
      ↓
Domain Service
      ↓
Database
```

---

# 27. Structured AI Commands

Example:

```json
{
  "intent": "CREATE_EXPENSE",
  "amount": 350,
  "currency": "ETB",
  "category": "FOOD",
  "date": "2026-08-25",
  "description": "Lunch"
}
```

The backend must validate this object using a schema.

AI output must never be trusted as valid input.

---

# 28. AI Must Not Have Database Access

Never implement:

```text
LLM → Database
```

Always:

```text
LLM → Structured command → Backend → Domain Service → Database
```

The LLM should not have:

* Database credentials
* Repository access
* Direct SQL access
* Administrative permissions

---

# 29. AI Confidence / Ambiguity

If information is missing or ambiguous, ask the user.

Example:

```text
User:
I spent 500.

Bot:
What did you spend the 500 ETB on?
```

Do not guess important financial information.

For uncertain interpretation:

```text
I think you spent 500 ETB on Food yesterday.
Is that correct?

[Confirm]
[Edit]
[Cancel]
```

---

# 30. Natural Language Commands

Initial intents:

```text
CREATE_EXPENSE
CREATE_INCOME
CREATE_DEBT
RECORD_DEBT_PAYMENT
CREATE_REMINDER
CREATE_BUDGET
CREATE_SAVINGS_GOAL
QUERY_SPENDING
QUERY_BALANCE
QUERY_DEBT
QUERY_REPORT
```

The intent system should be extensible.

---

# 31. Language Support

Initial:

```text
English
```

Next:

```text
Amharic
```

Potential future:

```text
Afaan Oromo
Tigrinya
```

Do not hard-code English strings into domain logic.

Use localization resources.

---

# 32. Background Jobs

Long-running or scheduled work must not block HTTP requests.

Use:

```text
API
 ↓
Redis/BullMQ
 ↓
Worker
```

Jobs include:

```text
ReminderJob
NotificationJob
MonthlyReportJob
RecurringTransactionJob
SubscriptionJob
AIInsightJob
CleanupJob
```

---

# 33. Reminder Processing

Example:

```text
Reminder
   ↓
Scheduled time reached
   ↓
Worker
   ↓
Validate reminder
   ↓
Create notification
   ↓
Send Telegram message
   ↓
Mark notification delivered
```

Failed delivery should support retry.

---

# 34. Redis Rules

Redis can be used for:

* Queue
* Cache
* Rate limiting
* Temporary conversation state

Redis must NOT be the permanent source of financial truth.

If Redis is deleted:

```text
Financial data must remain intact.
```

---

# 35. API Architecture

Use REST.

Base path:

```text
/api/v1
```

Example:

```text
GET    /api/v1/dashboard

GET    /api/v1/transactions
POST   /api/v1/transactions
GET    /api/v1/transactions/:id
PATCH  /api/v1/transactions/:id
DELETE /api/v1/transactions/:id

GET    /api/v1/debts
POST   /api/v1/debts
PATCH  /api/v1/debts/:id
POST   /api/v1/debts/:id/payments

GET    /api/v1/budgets
POST   /api/v1/budgets
PATCH  /api/v1/budgets/:id
DELETE /api/v1/budgets/:id

GET    /api/v1/savings-goals
POST   /api/v1/savings-goals
POST   /api/v1/savings-goals/:id/contributions
DELETE /api/v1/savings-goals/:id

GET    /api/v1/reports/monthly
```

---

# 36. API Response Format

Prefer consistent responses.

Success:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "TRANSACTION_NOT_FOUND",
    "message": "Transaction was not found."
  }
}
```

Do not expose internal stack traces to users.

---

# 37. Validation

All external input must be validated.

Sources include:

* Telegram
* Mini App
* API clients
* Payment providers
* AI output

Use schema validation.

Recommended:

```text
Zod
```

Validation should occur before domain execution.

---

# 38. Authorization

Authentication answers:

> Who is this user?

Authorization answers:

> Is this user allowed to perform this operation?

Both are required.

Example:

```text
Authenticated User
        ↓
Transaction ID
        ↓
Ownership check
        ↓
Allowed
```

---

# 39. Subscription Architecture

Plans:

```text
FREE
PREMIUM_MONTHLY
PREMIUM_YEARLY
```

Feature entitlements should be centralized.

Example:

```text
AI_NATURAL_LANGUAGE        Premium only
RULE_BASED_LOGGING         Free and Premium
UNLIMITED_TRANSACTIONS     Free and Premium
ADVANCED_REPORTS           Premium only
UNLIMITED_REMINDERS        Premium only (Free cap: 5)
SAVINGS_GOALS              Premium only
BUDGETS                    Premium only
DEBT_TRACKING              Free and Premium (unlimited IOUs)
IOU_NUDGE                  Free and Premium (Telegram share, no payment)
```

## 39.1 Free plan (must ship)

Free is a complete notebook, not a demo. Cap intelligence and reminder count, never the ledger.

Free includes:

* Unlimited expenses and income
* Unlimited IOUs and partial payments
* Cash / Bank / Telebirr accounts
* Dashboard: remaining, income, expenses, top categories, needs attention
* Payday day of month on the profile (countdown only — do not invent remaining)
* Rule-based Telegram logging (no LLM): `80 taxi`, `80 ታክሲ`, `Abebe 2000`, `40000 salary`
* IOU nudge via Telegram share text (client-side `t.me/share`, no money movement)
* Up to 5 reminders, with bill templates (rent, Wi‑Fi, school, idir) that still count toward the cap
* Amharic and English

Free excludes:

* LLM / voice / messy-sentence AI (`FEATURE.AI_NATURAL_LANGUAGE`)
* Unlimited reminders
* Monthly vs previous-month reports
* Savings goals and budgets
* Equb groups

Telegram chat for Free users must call `parseWithFallback` only. Do not call the LLM provider unless `subscriptionService.canAccess(userId, FEATURE.AI_NATURAL_LANGUAGE)` is true.

Do not write:

```ts
if (user.plan === "premium")
```

throughout the application.

Prefer:

```ts
subscriptionService.canAccess(
  userId,
  FEATURE.ADVANCED_REPORTS
)
```

---

# 40. Payment Provider Architecture

Payments must be abstracted.

```text
PaymentService
       │
       ├── TelebirrProvider
       ├── MpesaProvider
       └── OtherProvider
```

The subscription system must not depend directly on one provider.

Payment webhooks must be:

* Authenticated
* Validated
* Idempotent
* Logged
* Processed asynchronously where appropriate

---

# 41. Security

Minimum security requirements:

* HTTPS everywhere
* Secure authentication
* Authorization checks
* Input validation
* Rate limiting
* Secure secrets
* No secrets in Git
* No sensitive financial data in logs
* Dependency updates
* Database backups
* Error monitoring

---

# 42. Secrets

Never commit:

```text
BOT_TOKEN
DATABASE_URL
LLM_API_KEY
PAYMENT_SECRET
JWT_SECRET
```

to Git.

Use environment variables or a secret manager.

Provide:

```text
.env.example
```

with placeholders only.

---

# 43. Logging

Use structured logging.

Every request should ideally have:

```text
requestId
timestamp
method
path
status
duration
```

Never log:

* Passwords
* Authentication tokens
* Payment secrets
* Telegram secrets
* Full financial conversation history unnecessarily

---

# 44. Error Handling

Use centralized error handling.

Expected business errors:

```text
TRANSACTION_NOT_FOUND
DEBT_NOT_FOUND
UNAUTHORIZED
FORBIDDEN
INVALID_AMOUNT
INVALID_CATEGORY
SUBSCRIPTION_REQUIRED
AI_PARSE_FAILED
PAYMENT_FAILED
```

Errors should be converted to safe user-facing messages.

Internal technical details should stay in logs.

---

# 45. Rate Limiting

Rate-limit:

* Telegram webhook processing
* Public API
* AI endpoints
* Authentication
* Payment endpoints

AI requests should have stricter limits because they have external cost.

---

# 46. Database Transactions

Use database transactions when multiple writes must succeed together.

Examples:

### Debt payment

```text
Create debt payment
+
Update debt balance
```

### Subscription payment

```text
Create payment
+
Update subscription
```

### Recurring transaction

```text
Create transaction
+
Update recurring schedule
```

---

# 47. Reporting

Monthly report should include:

```text
Income
Expenses
Savings
Savings rate
Top categories
Largest expenses
Comparison with previous month
Budget performance
```

Example:

```text
August Report

Income:
40,000 ETB

Expenses:
27,500 ETB

Savings:
12,500 ETB

Savings rate:
31%

Top category:
Food
```

---

# 48. Dashboard

Dashboard should prioritize useful information.

Example:

```text
This Month

Income       40,000 ETB
Expenses     27,450 ETB
Remaining    12,550 ETB

Top Spending

Food          7,200
Rent          8,000
Transport     4,500
Shopping      3,200
```

Avoid unnecessary dashboards and metrics.

---

# 49. Testing Strategy

Three levels:

## Unit Tests

Test:

* Services
* Business rules
* Financial calculations
* Budget calculations
* Debt calculations

---

## Integration Tests

Test:

```text
API
 ↓
Service
 ↓
Repository
 ↓
PostgreSQL
```

---

## End-to-End Tests

Test real user flows:

```text
Start bot
 ↓
Create expense
 ↓
Confirm
 ↓
View dashboard
```

Also:

```text
Create debt
 ↓
Create reminder
 ↓
Worker runs
 ↓
Notification sent
```

---

# 50. Important Test Cases

Always test:

* Duplicate Telegram update
* Duplicate payment webhook
* Unauthorized transaction access
* Unauthorized debt access
* Invalid AI output
* Missing amount
* Missing category
* Invalid date
* Negative transaction
* Zero transaction
* Very large transaction
* Concurrent debt payments
* Reminder retry
* Subscription expiration
* Failed payment
* Database failure

---

# 51. Database Migrations

All schema changes must use migrations.

Never manually change production schema.

Process:

```text
Schema change
      ↓
Migration
      ↓
Test
      ↓
Deploy
```

Migration files must be committed to Git.

---

# 52. Backups

PostgreSQL must have automated backups.

Recovery must be tested periodically.

The team must know:

* Backup frequency
* Retention period
* Recovery procedure
* Recovery point objective
* Recovery time objective

---

# 53. Deployment

Initial deployment should be simple.

Recommended:

```text
Docker
+
Managed PostgreSQL
+
Managed Redis
+
Application server
+
Worker
```

Do NOT introduce Kubernetes initially.

---

# 54. Environments

Maintain:

```text
Development
Staging
Production
```

Each environment must have separate:

* Database
* Redis
* Secrets
* Telegram bot configuration where appropriate
* Payment configuration

---

# 55. CI/CD

Every pull request should run:

```text
Lint
Typecheck
Unit Tests
Integration Tests
Build
```

Production deployment should happen only after CI passes.

---

# 56. Health Checks

Provide:

```text
GET /health
GET /ready
```

`/health` checks whether the application process is alive.

`/ready` checks whether required dependencies are available.

---

# 57. Observability

Production monitoring should include:

* API errors
* Database errors
* Redis errors
* Telegram webhook failures
* AI failures
* Payment failures
* Notification failures
* Response time
* Queue depth
* Worker failures

Use an error tracking platform such as Sentry or equivalent.

---

# 58. Performance Targets

Initial target:

```text
Normal API response:
< 500ms where practical

Telegram interaction:
< 2 seconds where practical
```

AI requests may naturally take longer.

Long operations should be asynchronous.

---

# 59. Scalability Target

The initial architecture should comfortably support:

```text
5,000 users
```

without architectural redesign.

The architecture should allow future scaling to:

```text
50,000+
100,000+
```

by:

* Adding application instances
* Scaling PostgreSQL
* Scaling Redis
* Adding workers
* Introducing read replicas if required
* Extracting heavy modules only when justified

---

# 60. What NOT to Build in MVP

Do NOT implement these initially:

* Bank integrations
* Telebirr account synchronization
* M-Pesa account synchronization
* Money transfers
* Loans
* Credit scoring
* Investments
* Cryptocurrency
* Insurance
* Marketplace
* Social network
* Full accounting
* Complex family accounts

These are future possibilities.

---

# 61. MVP Scope

The first release must focus on:

## User

* Telegram registration
* Profile
* Language
* Currency
* Timezone
* Optional monthly income
* Optional payday day (1–31)

## Transactions

* Create expense
* Create income
* View transactions
* Edit transaction
* Delete transaction
* Categories
* Payment methods (Cash, Bank, Telebirr)

## Chat logging (Free)

* Rule-based parser only (`parseWithFallback`)
* Shorthand: `80 taxi`, `80 ታክሲ`
* IOU shorthand: `Abebe 2000`
* Salary shorthand: `40000 salary`
* Full sentences still work: "I spent 350 birr on lunch"

## Chat logging (Premium)

* LLM natural-language parsing
* Fallback to the rule-based parser on LLM failure

## Debts

* Someone owes me
* I owe someone
* Debt payment
* Debt history
* Nudge in Telegram (share text, no collection)

## Reminders

* One-time reminder
* Monthly bill templates (rent, Wi‑Fi, school, idir)
* Free cap: 5 active reminders
* Premium: unlimited

## Dashboard

* Income
* Expenses
* Remaining amount (backend DTO only)
* Payday countdown (calendar math from `payday_day`, not a forecast)
* Top categories
* Needs attention (open IOUs + reminders)

## Subscription

* Free plan as specified in §39.1
* Premium plan: AI chat, unlimited reminders, advanced reports, savings

---

# 62. MVP User Flow

## First-time user

```text
/start
   ↓
Welcome
   ↓
Select language
   ↓
Set currency
   ↓
Optional monthly income
   ↓
Dashboard
```

---

## Expense

```text
"I spent 300 birr on lunch"

       ↓

AI parser

       ↓

{
  type: expense,
  amount: 300,
  category: food
}

       ↓

Confirmation

       ↓

Save

       ↓

"✓ 300 ETB Food recorded."
```

---

## Debt

```text
"Abebe owes me 2,000"

       ↓

Debt parser

       ↓

Confirmation

       ↓

Save

       ↓

"✓ Abebe owes you 2,000 ETB."
```

---

## Reminder

```text
"Remind me to pay rent on September 1"

       ↓

Reminder parser

       ↓

Validation

       ↓

Save

       ↓

Scheduled job

       ↓

Telegram notification
```

---

# 63. Coding Rules for Cursor

When generating code:

### Rule 1

Do not create unnecessary files.

### Rule 2

Do not create unnecessary abstractions.

### Rule 3

Do not introduce microservices.

### Rule 4

Do not access the database directly from controllers.

### Rule 5

Do not access the database directly from AI code.

### Rule 6

Do not put business logic in controllers.

### Rule 7

Do not put business logic in React components.

### Rule 8

Do not trust client-supplied user IDs.

### Rule 9

Do not use floating point for financial calculations.

### Rule 10

Do not bypass validation.

### Rule 11

Do not expose secrets.

### Rule 12

Do not log sensitive financial information.

### Rule 13

Do not duplicate business logic across Bot and Mini App.

### Rule 14

Bot and Mini App must use the same backend domain services.

### Rule 15

New database schema changes require migrations.

---

# 64. Frontend Rules

React components should focus on presentation and interaction.

Do not place business calculations such as:

```text
monthly spending
debt balance
budget percentage
```

inside UI components if those values belong to backend business logic.

Prefer:

```text
Backend
 ↓
API DTO
 ↓
React
```

The frontend can perform purely presentational calculations when appropriate.

---

# 65. Backend Rules

Backend services are authoritative.

The backend must validate:

* Amount
* Currency
* User ownership
* Dates
* Categories
* Subscription permissions
* Business constraints

Never rely on frontend validation alone.

---

# 66. Repository Rules

Repositories should:

* Query data
* Persist data
* Return domain-friendly results

Repositories should NOT:

* Send Telegram messages
* Call LLMs
* Check subscription plans
* Decide business workflows

---

# 67. Service Rules

Services should:

* Execute business workflows
* Coordinate repositories
* Enforce domain rules
* Handle transactions

Services should NOT:

* Render UI
* Know Telegram-specific message formatting
* Depend directly on React
* Parse HTTP requests

---

# 68. Telegram Rules

Telegram-specific logic belongs under:

```text
integrations/telegram
```

Do not spread Telegram SDK calls throughout domain services.

Bad:

```text
TransactionService
    ↓
TelegramBot.sendMessage()
```

Prefer:

```text
TransactionService
    ↓
Domain result
    ↓
Telegram handler
    ↓
Telegram adapter
```

---

# 69. AI Rules

AI prompts must be versioned.

For example:

```text
ai/prompts/
    transaction-parser.v1.ts
    transaction-parser.v2.ts
```

AI output must use strict schemas.

Every AI-powered operation should have a fallback when the AI provider fails.

Example:

```text
AI unavailable.

Please enter:
Amount
Category
```

The core financial system must continue working without AI.

---

# 70. External Provider Rules

External providers must be wrapped behind interfaces.

Example:

```ts
interface PaymentProvider {
  createPayment(...): Promise<PaymentResult>;
  verifyPayment(...): Promise<PaymentVerification>;
}
```

Similarly:

```ts
interface LLMProvider {
  parse(...): Promise<StructuredCommand>;
}
```

This allows provider replacement without rewriting the domain.

---

# 71. Feature Addition Process

When adding a feature:

```text
1. Define requirement
        ↓
2. Identify domain module
        ↓
3. Define data model
        ↓
4. Create migration
        ↓
5. Create schema
        ↓
6. Implement repository
        ↓
7. Implement service
        ↓
8. Implement controller/API
        ↓
9. Implement Telegram/Mini App interface
        ↓
10. Add tests
        ↓
11. Update documentation
```

---

# 72. New Feature Checklist

Before considering a feature complete:

* [ ] Requirement defined
* [ ] Correct domain module selected
* [ ] Database model reviewed
* [ ] Migration created
* [ ] Validation implemented
* [ ] Authorization implemented
* [ ] Service implemented
* [ ] Repository implemented
* [ ] API implemented if required
* [ ] Telegram flow implemented if required
* [ ] Mini App UI implemented if required
* [ ] Error handling implemented
* [ ] Unit tests added
* [ ] Integration tests added
* [ ] Documentation updated

---

# 73. Definition of Done

A feature is DONE only when:

1. It works through the intended user interface.
2. Backend validation exists.
3. Authorization exists.
4. Database changes have migrations.
5. Errors are handled.
6. Tests exist.
7. No secrets are introduced.
8. No sensitive information is unnecessarily logged.
9. Existing features still work.
10. Architecture boundaries remain intact.

---

# 74. Architecture Anti-Patterns

Avoid:

## God Service

```text
FinanceService
```

containing everything.

Instead:

```text
TransactionService
DebtService
BudgetService
SavingsService
```

---

## God Controller

Controllers must remain thin.

---

## AI as Business Logic

AI should interpret language.

It should not determine authoritative financial state.

---

## Frontend as Source of Truth

The backend is authoritative.

---

## Redis as Database

Redis is not permanent financial storage.

---

## Telegram-Coupled Domain

Domain services must not depend on Telegram.

---

## Microservices Too Early

Do not create:

```text
transaction-service
debt-service
budget-service
user-service
```

as separate applications during MVP.

---

# 75. Security Priority

Security priorities:

```text
1. User isolation
2. Authentication
3. Authorization
4. Financial integrity
5. Secret management
6. Input validation
7. Rate limiting
8. Auditability
9. Monitoring
10. Backup/recovery
```

---

# 76. Privacy Principle

The product handles sensitive financial information.

Collect only information required for the product.

Do not:

* Sell financial data
* Log unnecessary financial conversations
* Store unnecessary personal information
* Expose user financial data to administrators unnecessarily

Provide:

* Privacy policy
* Terms
* Data deletion
* Data export

---

# 77. Architecture Decision Records

For major decisions, create ADR documents:

```text
docs/adr/
```

Example:

```text
docs/adr/
├── 001-modular-monolith.md
├── 002-postgresql-as-source-of-truth.md
├── 003-telegram-first.md
├── 004-ai-command-architecture.md
└── 005-redis-background-jobs.md
```

If a future decision conflicts with this document, create an ADR explaining:

* Problem
* Current decision
* Alternatives
* Decision
* Consequences

---

# 78. Development Priority

Recommended implementation order:

## Phase 1

Project setup

```text
Monorepo
TypeScript
Backend
Mini App
PostgreSQL
Docker
CI
```

## Phase 2

User system

```text
Telegram identity
Profile
Settings
```

## Phase 3

Transactions

```text
Expense
Income
Categories
Accounts
History
```

## Phase 4

Telegram Bot

```text
/start
Expense messages
Income messages
Confirmation
```

## Phase 5

Debts

```text
Create debt
Payment
History
```

## Phase 6

Reminders

```text
Create reminder
Worker
Telegram notification
```

## Phase 7

Dashboard

```text
Summary
Categories
Charts
```

## Phase 8

AI

```text
Intent parser
Structured commands
Natural-language queries
```

## Phase 9

Subscriptions

```text
Free
Premium
Payment integration
```

## Phase 10

Reports

```text
Monthly report
Insights
```

---

# 79. Recommended Initial Architecture

The initial production architecture should be:

```text
                         ┌──────────────────────┐
                         │       TELEGRAM       │
                         │                      │
                         │ Bot + Mini App       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      NGINX/LB        │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │   Node.js Backend    │
                         │   Modular Monolith   │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └─────────────┐
                    ▼                                  ▼
             ┌─────────────┐                     ┌────────────┐
             │ PostgreSQL  │                     │   Redis    │
             │             │                     │            │
             │ Source of   │                     │ Queue      │
             │ Truth       │                     │ Cache      │
             └─────────────┘                     └─────┬──────┘
                                                       │
                                                ┌──────▼──────┐
                                                │   Worker    │
                                                │             │
                                                │ Reminders   │
                                                │ Reports     │
                                                │ Notifs      │
                                                └──────┬──────┘
                                                       │
                                      ┌────────────────┼─────────────┐
                                      ▼                ▼             ▼
                                  Telegram            LLM        Payments
```

---

# 80. Final Architectural Principles

The following rules are considered non-negotiable unless an ADR explicitly changes them:

1. **Modular monolith first.**
2. **PostgreSQL is the financial source of truth.**
3. **Telegram is an interface, not the domain layer.**
4. **Mini App and Bot share the same backend.**
5. **AI interprets; backend decides.**
6. **LLM never directly accesses the database.**
7. **Every user-owned record is isolated by user ID.**
8. **Never use floating point for money.**
9. **Financial multi-write operations are atomic.**
10. **External webhooks must be idempotent.**
11. **Background tasks use workers.**
12. **Redis is not permanent storage.**
13. **Controllers remain thin.**
14. **Business logic belongs in services/domain modules.**
15. **Database access belongs in repositories.**
16. **External providers are accessed through adapters/interfaces.**
17. **Secrets never enter source control.**
18. **Sensitive financial data is not unnecessarily logged.**
19. **Schema changes require migrations.**
20. **Every important feature requires tests.**
21. **Do not introduce infrastructure without a clear need.**
22. **Do not build out-of-scope fintech functionality during MVP.**
23. **Prefer simple solutions until real scale requires complexity.**
24. **Preserve the ability to add web/mobile clients later.**
25. **When architecture changes, document the decision.**

---

# 81. Cursor Instruction

When working on this project, treat this document as the primary architectural specification.

Before implementing a task:

```text
1. Understand the requested feature.
2. Identify the affected domain module.
3. Check existing code before creating new abstractions.
4. Follow the dependency direction.
5. Preserve user data isolation.
6. Validate all external input.
7. Keep financial operations atomic.
8. Add or update tests.
9. Avoid unnecessary infrastructure.
10. Do not violate the architectural principles in this document.
```

If a requested implementation conflicts with this architecture:

**Do not silently introduce the conflicting architecture.**

Instead:

1. Explain the conflict.
2. Propose the smallest compatible solution.
3. If a genuine architectural change is required, create/update an ADR.
4. Update this document only after the architectural decision is accepted.

---

# END OF PROJECT ARCHITECTURE
