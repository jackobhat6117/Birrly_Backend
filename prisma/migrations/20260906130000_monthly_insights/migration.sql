-- Premium "Insights" on Reports: cached, LLM-phrased narration of numbers the
-- backend already computed. Generated once per user per month and reused
-- until the user taps Refresh, so this never fires on every page view.
CREATE TABLE "monthly_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "insights" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_insights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_insights_user_id_year_month_key" ON "monthly_insights"("user_id", "year", "month");

ALTER TABLE "monthly_insights" ADD CONSTRAINT "monthly_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
