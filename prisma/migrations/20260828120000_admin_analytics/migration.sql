-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "product_event_name" AS ENUM ('SCREEN_VIEW', 'TOUR_STARTED', 'TOUR_COMPLETED', 'TOUR_SKIPPED', 'FEATURE_USED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" "product_event_name" NOT NULL,
    "screen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "product_events_user_id_created_at_idx" ON "product_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "product_events_name_created_at_idx" ON "product_events"("name", "created_at");

-- CreateIndex
CREATE INDEX "product_events_screen_created_at_idx" ON "product_events"("screen", "created_at");

-- AddForeignKey
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
