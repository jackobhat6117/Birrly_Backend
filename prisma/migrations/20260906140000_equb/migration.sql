-- Equb (rotating savings group) — Premium feature. Birrly tracks contributions
-- and rotation; it never moves money between members.
CREATE TYPE "equb_frequency" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "equb_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "equbs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contribution_amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "frequency" "equb_frequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "status" "equb_status" NOT NULL DEFAULT 'ACTIVE',
    "current_cycle" INTEGER NOT NULL DEFAULT 1,
    "join_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equbs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equb_members" (
    "id" TEXT NOT NULL,
    "equb_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegram_user_id" TEXT,
    "telegram_username" TEXT,
    "payout_position" INTEGER NOT NULL,
    "payout_received" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equb_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equb_contributions" (
    "id" TEXT NOT NULL,
    "equb_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equb_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equbs_join_token_key" ON "equbs"("join_token");
CREATE INDEX "equbs_user_id_status_idx" ON "equbs"("user_id", "status");
CREATE INDEX "equb_members_equb_id_idx" ON "equb_members"("equb_id");
CREATE INDEX "equb_members_telegram_user_id_idx" ON "equb_members"("telegram_user_id");
CREATE UNIQUE INDEX "equb_contributions_member_id_cycle_key" ON "equb_contributions"("member_id", "cycle");
CREATE INDEX "equb_contributions_equb_id_cycle_idx" ON "equb_contributions"("equb_id", "cycle");

ALTER TABLE "equbs" ADD CONSTRAINT "equbs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equb_members" ADD CONSTRAINT "equb_members_equb_id_fkey" FOREIGN KEY ("equb_id") REFERENCES "equbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equb_contributions" ADD CONSTRAINT "equb_contributions_equb_id_fkey" FOREIGN KEY ("equb_id") REFERENCES "equbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equb_contributions" ADD CONSTRAINT "equb_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "equb_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
