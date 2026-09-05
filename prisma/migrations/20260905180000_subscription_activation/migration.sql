-- Subscription activation: Telebirr requests, promo codes, trial source
CREATE TYPE "subscription_source" AS ENUM ('SIGNUP_TRIAL', 'TELEBIRR', 'PROMO', 'ADMIN');
CREATE TYPE "upgrade_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "subscriptions" ADD COLUMN "source" "subscription_source";

CREATE TABLE "subscription_upgrade_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "plan" "subscription_plan" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "upgrade_request_status" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_upgrade_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plan" "subscription_plan" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 100,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_upgrade_requests_reference_code_key" ON "subscription_upgrade_requests"("reference_code");
CREATE INDEX "subscription_upgrade_requests_user_id_status_idx" ON "subscription_upgrade_requests"("user_id", "status");
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

ALTER TABLE "subscription_upgrade_requests" ADD CONSTRAINT "subscription_upgrade_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "promo_codes" ("id", "code", "plan", "duration_days", "max_uses", "used_count", "active", "note", "updated_at")
VALUES
  ('promo-birrly-beta', 'BIRRLY-BETA', 'PREMIUM_MONTHLY', 30, 500, 0, true, 'Beta testers — 30 days Premium', CURRENT_TIMESTAMP),
  ('promo-founder30', 'FOUNDER30', 'PREMIUM_MONTHLY', 30, 100, 0, true, 'Founding users — 30 days Premium', CURRENT_TIMESTAMP);
