-- CreateEnum
CREATE TYPE "group_budget_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "group_budgets" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "period_unit" "budget_period_unit" NOT NULL DEFAULT 'MONTH',
    "period_count" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "join_token" TEXT NOT NULL,
    "telegram_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_budget_members" (
    "id" TEXT NOT NULL,
    "group_budget_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "group_budget_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_budget_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_budget_expenses" (
    "id" TEXT NOT NULL,
    "group_budget_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "description" TEXT,
    "spent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "transaction_source" NOT NULL DEFAULT 'MINI_APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_budget_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_budgets_join_token_key" ON "group_budgets"("join_token");
CREATE INDEX "group_budgets_created_by_id_idx" ON "group_budgets"("created_by_id");
CREATE INDEX "group_budgets_telegram_chat_id_idx" ON "group_budgets"("telegram_chat_id");
CREATE INDEX "group_budgets_join_token_idx" ON "group_budgets"("join_token");

-- CreateIndex
CREATE UNIQUE INDEX "group_budget_members_group_budget_id_user_id_key" ON "group_budget_members"("group_budget_id", "user_id");
CREATE INDEX "group_budget_members_user_id_idx" ON "group_budget_members"("user_id");

-- CreateIndex
CREATE INDEX "group_budget_expenses_group_budget_id_spent_at_idx" ON "group_budget_expenses"("group_budget_id", "spent_at");
CREATE INDEX "group_budget_expenses_user_id_idx" ON "group_budget_expenses"("user_id");

-- AddForeignKey
ALTER TABLE "group_budgets" ADD CONSTRAINT "group_budgets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_members" ADD CONSTRAINT "group_budget_members_group_budget_id_fkey" FOREIGN KEY ("group_budget_id") REFERENCES "group_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_members" ADD CONSTRAINT "group_budget_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_expenses" ADD CONSTRAINT "group_budget_expenses_group_budget_id_fkey" FOREIGN KEY ("group_budget_id") REFERENCES "group_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_expenses" ADD CONSTRAINT "group_budget_expenses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_budget_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_expenses" ADD CONSTRAINT "group_budget_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_budget_expenses" ADD CONSTRAINT "group_budget_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
