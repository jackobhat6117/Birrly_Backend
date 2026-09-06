-- Store the debtor's Telegram @username (without the "@") so the Mini App can
-- deep-link a Nudge straight to their chat instead of falling back to the
-- generic share picker. Optional — old debts and users who don't know an
-- @username still get today's behavior.
ALTER TABLE "debts" ADD COLUMN "person_telegram_username" TEXT;
