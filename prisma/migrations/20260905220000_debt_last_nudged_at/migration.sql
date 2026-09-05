-- Track when a debt was last nudged in Telegram, so the Mini App can show
-- "Nudged 2 days ago" instead of leaving the user to guess whether they
-- already reminded someone.
ALTER TABLE "debts" ADD COLUMN "last_nudged_at" TIMESTAMP(3);
