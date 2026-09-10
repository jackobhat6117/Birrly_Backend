/*
  Warnings:

  - Added the required column `name` to the `budgets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "budget_scope" AS ENUM ('ADDED_ONLY', 'ALL_TRANSACTIONS');

-- CreateEnum
CREATE TYPE "budget_period_unit" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "budget_category_mode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- AlterTable
-- NOTE: "name" is added NULLABLE here and backfilled below (from the linked
-- category) before being set NOT NULL, so existing budgets migrate cleanly.
ALTER TABLE "budgets" ADD COLUMN     "color" TEXT NOT NULL DEFAULT 'green',
ADD COLUMN     "include_income" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "include_lent_borrowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "period_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "period_unit" "budget_period_unit" NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "scope" "budget_scope" NOT NULL DEFAULT 'ALL_TRANSACTIONS',
ALTER COLUMN "category_id" DROP NOT NULL,
ALTER COLUMN "period" SET DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "mode" "budget_category_mode" NOT NULL DEFAULT 'INCLUDE',

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_accounts" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,

    CONSTRAINT "budget_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_transactions" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,

    CONSTRAINT "budget_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_categories_budget_id_idx" ON "budget_categories"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_budget_id_category_id_mode_key" ON "budget_categories"("budget_id", "category_id", "mode");

-- CreateIndex
CREATE INDEX "budget_accounts_budget_id_idx" ON "budget_accounts"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_accounts_budget_id_account_id_key" ON "budget_accounts"("budget_id", "account_id");

-- CreateIndex
CREATE INDEX "budget_transactions_budget_id_idx" ON "budget_transactions"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_transactions_budget_id_transaction_id_key" ON "budget_transactions"("budget_id", "transaction_id");

-- CreateIndex
CREATE INDEX "budgets_user_id_start_date_idx" ON "budgets"("user_id", "start_date");

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Data backfill for existing budgets (idempotent, safe on empty tables)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Name each existing budget after its linked category (fallback "Budget").
UPDATE "budgets" b
SET "name" = c."name"
FROM "categories" c
WHERE b."category_id" = c."id" AND b."name" IS NULL;

UPDATE "budgets" SET "name" = 'Budget' WHERE "name" IS NULL;

-- 2) Now that every row has a name, enforce NOT NULL to match the Prisma schema.
ALTER TABLE "budgets" ALTER COLUMN "name" SET NOT NULL;

-- 3) Convert each legacy single-category budget into an INCLUDE join row.
INSERT INTO "budget_categories" ("id", "budget_id", "category_id", "mode")
SELECT gen_random_uuid()::text, b."id", b."category_id", 'INCLUDE'
FROM "budgets" b
WHERE b."category_id" IS NOT NULL
ON CONFLICT ("budget_id", "category_id", "mode") DO NOTHING;
