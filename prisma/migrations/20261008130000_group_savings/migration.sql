-- CreateTable
CREATE TABLE "group_savings_goals" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" DECIMAL(19,4) NOT NULL,
    "current_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "target_date" DATE,
    "join_token" TEXT NOT NULL,
    "telegram_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_savings_members" (
    "id" TEXT NOT NULL,
    "group_savings_goal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "group_budget_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_savings_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_savings_contributions" (
    "id" TEXT NOT NULL,
    "group_savings_goal_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "note" TEXT,
    "contributed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "transaction_source" NOT NULL DEFAULT 'MINI_APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_savings_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_savings_goals_join_token_key" ON "group_savings_goals"("join_token");
CREATE INDEX "group_savings_goals_created_by_id_idx" ON "group_savings_goals"("created_by_id");
CREATE INDEX "group_savings_goals_telegram_chat_id_idx" ON "group_savings_goals"("telegram_chat_id");
CREATE INDEX "group_savings_goals_join_token_idx" ON "group_savings_goals"("join_token");

-- CreateIndex
CREATE UNIQUE INDEX "group_savings_members_group_savings_goal_id_user_id_key" ON "group_savings_members"("group_savings_goal_id", "user_id");
CREATE INDEX "group_savings_members_user_id_idx" ON "group_savings_members"("user_id");

-- CreateIndex
CREATE INDEX "group_savings_contributions_group_savings_goal_id_contributed_at_idx" ON "group_savings_contributions"("group_savings_goal_id", "contributed_at");
CREATE INDEX "group_savings_contributions_user_id_idx" ON "group_savings_contributions"("user_id");

-- AddForeignKey
ALTER TABLE "group_savings_goals" ADD CONSTRAINT "group_savings_goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_savings_members" ADD CONSTRAINT "group_savings_members_group_savings_goal_id_fkey" FOREIGN KEY ("group_savings_goal_id") REFERENCES "group_savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_savings_members" ADD CONSTRAINT "group_savings_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_savings_contributions" ADD CONSTRAINT "group_savings_contributions_group_savings_goal_id_fkey" FOREIGN KEY ("group_savings_goal_id") REFERENCES "group_savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_savings_contributions" ADD CONSTRAINT "group_savings_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_savings_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_savings_contributions" ADD CONSTRAINT "group_savings_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
